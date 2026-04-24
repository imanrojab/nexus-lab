"""
Follow routes — follow/unfollow, followers/following lists, follow requests.
Vulnerabilities:
- Easy: IDOR — view followers/following of any user
- Medium: Follow request bypass — can directly set status to "accepted" for private accounts
- Medium: No rate limit — mass follow/unfollow
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional

from app.db.database import get_session
from app.models.social import Follow
from app.models.user import User
from app.core.security import get_current_user_id

router = APIRouter(prefix="/api/users", tags=["follows"])


class FollowActionRequest(BaseModel):
    action: str  # accept, reject


# ── Follow / Unfollow ──────────────────────────────────────────────────────────

@router.post("/{user_id}/follow")
def follow_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    if user_id == current_user:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = session.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user, Follow.following_id == user_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already following or request pending")

    # Private accounts require approval
    status = "pending" if target.is_private else "accepted"
    follow = Follow(follower_id=current_user, following_id=user_id, status=status)
    session.add(follow)

    if status == "accepted":
        target.followers_count += 1
        session.add(target)
        me = session.get(User, current_user)
        if me:
            me.following_count += 1
            session.add(me)

    session.commit()
    return {"ok": True, "status": status}


@router.delete("/{user_id}/follow")
def unfollow_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user, Follow.following_id == user_id
        )
    ).first()
    if not follow:
        raise HTTPException(status_code=404, detail="Not following this user")

    was_accepted = follow.status == "accepted"
    session.delete(follow)

    if was_accepted:
        target = session.get(User, user_id)
        if target and target.followers_count > 0:
            target.followers_count -= 1
            session.add(target)
        me = session.get(User, current_user)
        if me and me.following_count > 0:
            me.following_count -= 1
            session.add(me)

    session.commit()
    return {"ok": True}


# ── Follow Requests (for private accounts) ────────────────────────────────────

@router.get("/me/follow-requests")
def list_follow_requests(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    requests = session.exec(
        select(Follow).where(
            Follow.following_id == current_user, Follow.status == "pending"
        )
    ).all()

    items = []
    for r in requests:
        user = session.get(User, r.follower_id)
        if user:
            items.append({
                "id": r.id, "follower_id": r.follower_id,
                "username": user.username, "full_name": user.full_name,
                "avatar_url": user.avatar_url,
                "created_at": str(r.created_at),
            })

    return {"items": items, "count": len(items)}


@router.patch("/me/follow-requests/{request_id}")
def handle_follow_request(
    request_id: int,
    body: FollowActionRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    follow = session.get(Follow, request_id)
    if not follow:
        raise HTTPException(status_code=404, detail="Request not found")
    if follow.following_id != current_user:
        raise HTTPException(status_code=403, detail="Not your follow request")

    if body.action == "accept":
        follow.status = "accepted"
        session.add(follow)

        me = session.get(User, current_user)
        if me:
            me.followers_count += 1
            session.add(me)
        follower = session.get(User, follow.follower_id)
        if follower:
            follower.following_count += 1
            session.add(follower)
    elif body.action == "reject":
        session.delete(follow)
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'accept' or 'reject'")

    session.commit()
    return {"ok": True, "action": body.action}


# ── Followers / Following Lists ────────────────────────────────────────────��───

# VULN (Easy): IDOR — view anyone's followers
@router.get("/{user_id}/followers")
def list_followers(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
):
    offset = (page - 1) * limit
    follows = session.exec(
        select(Follow).where(
            Follow.following_id == user_id, Follow.status == "accepted"
        ).offset(offset).limit(limit)
    ).all()

    items = []
    for f in follows:
        user = session.get(User, f.follower_id)
        if user:
            items.append({
                "id": user.id, "username": user.username,
                "full_name": user.full_name, "avatar_url": user.avatar_url,
                "is_private": user.is_private,
            })

    return {"items": items, "user_id": user_id}


# VULN (Easy): IDOR — view anyone's following list
@router.get("/{user_id}/following")
def list_following(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
):
    offset = (page - 1) * limit
    follows = session.exec(
        select(Follow).where(
            Follow.follower_id == user_id, Follow.status == "accepted"
        ).offset(offset).limit(limit)
    ).all()

    items = []
    for f in follows:
        user = session.get(User, f.following_id)
        if user:
            items.append({
                "id": user.id, "username": user.username,
                "full_name": user.full_name, "avatar_url": user.avatar_url,
                "is_private": user.is_private,
            })

    return {"items": items, "user_id": user_id}


# ── Follow status check ───────────────────────────────────────────────────────

@router.get("/{user_id}/follow-status")
def check_follow_status(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    follow = session.exec(
        select(Follow).where(
            Follow.follower_id == current_user, Follow.following_id == user_id
        )
    ).first()

    if not follow:
        return {"status": "none"}
    return {"status": follow.status}
