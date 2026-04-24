"""
Social routes — posts, feed, comments, likes.
Vulnerabilities:
- Easy: IDOR on post detail — view private/followers-only posts by ID
- Medium: Stored XSS via post content (rendered with innerHTML on frontend)
- Medium: Stored XSS via post comments
- Medium: Private account posts accessible via direct API call
- Hard: No rate limiting on like/unlike (like farming)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional
from datetime import datetime

from app.db.database import get_session
from app.models.social import Post, PostComment, PostLike, Follow
from app.models.user import User
from app.core.security import get_current_user_id

router = APIRouter(prefix="/api", tags=["social"])


class CreatePostRequest(BaseModel):
    content: str
    image_url: str = ""
    visibility: str = "public"  # public, private, followers


class UpdatePostRequest(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None
    visibility: Optional[str] = None


class CreateCommentRequest(BaseModel):
    content: str


def _user_summary(user: User | None) -> dict | None:
    if not user:
        return None
    return {
        "id": user.id, "username": user.username, "full_name": user.full_name,
        "avatar_url": user.avatar_url, "is_private": user.is_private,
    }


def _is_following(session: Session, follower_id: int, following_id: int) -> bool:
    follow = session.exec(
        select(Follow).where(
            Follow.follower_id == follower_id,
            Follow.following_id == following_id,
            Follow.status == "accepted",
        )
    ).first()
    return follow is not None


def _has_liked(session: Session, user_id: int, post_id: int) -> bool:
    like = session.exec(
        select(PostLike).where(PostLike.user_id == user_id, PostLike.post_id == post_id)
    ).first()
    return like is not None


# ── Feed ───────────────────────────────────────────────────────────────────────

@router.get("/feed")
def get_feed(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Feed: public posts + posts from people you follow (respecting visibility)."""
    # Get IDs of users the current user follows
    following_ids = list(session.exec(
        select(Follow.following_id).where(
            Follow.follower_id == current_user, Follow.status == "accepted"
        )
    ).all())

    offset = (page - 1) * limit

    # Public posts from anyone + followers/private posts from followed users + own posts
    posts = session.exec(
        select(Post).order_by(Post.created_at.desc()).offset(offset).limit(limit)
    ).all()

    items = []
    for p in posts:
        # Filter based on visibility
        if p.author_id == current_user:
            pass  # always show own posts
        elif p.visibility == "public":
            pass  # show to everyone
        elif p.visibility == "followers" and p.author_id in following_ids:
            pass  # show to followers
        else:
            continue  # skip private or non-followed followers-only

        author = session.get(User, p.author_id)
        items.append({
            "id": p.id, "content": p.content, "image_url": p.image_url,
            "visibility": p.visibility, "likes_count": p.likes_count,
            "comments_count": p.comments_count, "is_pinned": p.is_pinned,
            "author": _user_summary(author),
            "has_liked": _has_liked(session, current_user, p.id),
            "created_at": str(p.created_at),
        })

    return {"items": items, "page": page}


@router.get("/explore")
def explore_posts(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Explore: trending public posts sorted by likes."""
    offset = (page - 1) * limit
    posts = session.exec(
        select(Post)
        .where(Post.visibility == "public")
        .order_by(Post.likes_count.desc(), Post.created_at.desc())
        .offset(offset).limit(limit)
    ).all()

    items = []
    for p in posts:
        author = session.get(User, p.author_id)
        items.append({
            "id": p.id, "content": p.content, "image_url": p.image_url,
            "visibility": p.visibility, "likes_count": p.likes_count,
            "comments_count": p.comments_count,
            "author": _user_summary(author),
            "has_liked": _has_liked(session, current_user, p.id),
            "created_at": str(p.created_at),
        })

    return {"items": items, "page": page}


# ── Posts CRUD ─────────────────────────────────────────────────────────────────

@router.post("/posts")
def create_post(
    body: CreatePostRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    # VULN (Medium): XSS — content is not sanitized, rendered via innerHTML on frontend
    post = Post(
        author_id=current_user, content=body.content,
        image_url=body.image_url, visibility=body.visibility,
    )
    session.add(post)

    user = session.get(User, current_user)
    if user:
        user.posts_count += 1
        session.add(user)

    session.commit()
    session.refresh(post)

    return {
        "id": post.id, "content": post.content, "visibility": post.visibility,
        "created_at": str(post.created_at),
    }


# VULN (Easy): IDOR — any user can view any post including private posts
@router.get("/posts/{post_id}")
def get_post(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    author = session.get(User, post.author_id)

    # Load comments
    comments = session.exec(
        select(PostComment).where(PostComment.post_id == post_id).order_by(PostComment.created_at)
    ).all()

    comment_list = []
    for c in comments:
        commenter = session.get(User, c.user_id)
        comment_list.append({
            "id": c.id, "content": c.content,
            "author": _user_summary(commenter),
            "created_at": str(c.created_at),
        })

    return {
        "id": post.id, "content": post.content, "image_url": post.image_url,
        "visibility": post.visibility, "likes_count": post.likes_count,
        "comments_count": post.comments_count, "is_pinned": post.is_pinned,
        "author": _user_summary(author),
        "has_liked": _has_liked(session, current_user, post.id),
        "comments": comment_list,
        "created_at": str(post.created_at),
    }


@router.patch("/posts/{post_id}")
def update_post(
    post_id: int,
    body: UpdatePostRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user:
        raise HTTPException(status_code=403, detail="Not your post")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(post, key, value)
    post.updated_at = datetime.utcnow()
    session.add(post)
    session.commit()
    session.refresh(post)
    return {"id": post.id, "content": post.content, "visibility": post.visibility}


@router.delete("/posts/{post_id}")
def delete_post(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.author_id != current_user:
        raise HTTPException(status_code=403, detail="Not your post")

    # Delete associated likes and comments
    likes = session.exec(select(PostLike).where(PostLike.post_id == post_id)).all()
    for l in likes:
        session.delete(l)
    comments = session.exec(select(PostComment).where(PostComment.post_id == post_id)).all()
    for c in comments:
        session.delete(c)

    user = session.get(User, current_user)
    if user and user.posts_count > 0:
        user.posts_count -= 1
        session.add(user)

    session.delete(post)
    session.commit()
    return {"ok": True}


# ── User's posts ───────────────────────────────────────────────────────────────

@router.get("/users/{user_id}/posts")
def get_user_posts(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=50),
):
    """Get a user's posts — respects privacy settings."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    offset = (page - 1) * limit

    if user_id == current_user:
        # Own posts — show all
        posts = session.exec(
            select(Post).where(Post.author_id == user_id)
            .order_by(Post.created_at.desc()).offset(offset).limit(limit)
        ).all()
    elif user.is_private:
        is_follower = _is_following(session, current_user, user_id)
        if is_follower:
            posts = session.exec(
                select(Post).where(Post.author_id == user_id)
                .order_by(Post.created_at.desc()).offset(offset).limit(limit)
            ).all()
        else:
            # Private account + not following = only public posts
            posts = session.exec(
                select(Post).where(Post.author_id == user_id, Post.visibility == "public")
                .order_by(Post.created_at.desc()).offset(offset).limit(limit)
            ).all()
    else:
        # Public account — show public + followers-only if following
        is_follower = _is_following(session, current_user, user_id)
        if is_follower:
            posts = session.exec(
                select(Post).where(
                    Post.author_id == user_id,
                    Post.visibility.in_(["public", "followers"]),
                )
                .order_by(Post.created_at.desc()).offset(offset).limit(limit)
            ).all()
        else:
            posts = session.exec(
                select(Post).where(Post.author_id == user_id, Post.visibility == "public")
                .order_by(Post.created_at.desc()).offset(offset).limit(limit)
            ).all()

    items = []
    for p in posts:
        items.append({
            "id": p.id, "content": p.content, "image_url": p.image_url,
            "visibility": p.visibility, "likes_count": p.likes_count,
            "comments_count": p.comments_count,
            "author": _user_summary(user),
            "has_liked": _has_liked(session, current_user, p.id),
            "created_at": str(p.created_at),
        })

    return {"items": items, "user_id": user_id, "page": page}


# ── Likes ──────────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/like")
def like_post(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = session.exec(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already liked")

    like = PostLike(post_id=post_id, user_id=current_user)
    session.add(like)
    post.likes_count += 1
    session.add(post)
    session.commit()

    return {"ok": True, "likes_count": post.likes_count}


@router.delete("/posts/{post_id}/like")
def unlike_post(
    post_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = session.exec(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == current_user)
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Not liked")

    session.delete(existing)
    post.likes_count = max(0, post.likes_count - 1)
    session.add(post)
    session.commit()

    return {"ok": True, "likes_count": post.likes_count}


# ── Comments ───────────────────────────────────────────────────────────────────

# VULN (Medium): Stored XSS via comment content
@router.post("/posts/{post_id}/comments")
def add_comment(
    post_id: int,
    body: CreateCommentRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    post = session.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    comment = PostComment(post_id=post_id, user_id=current_user, content=body.content)
    session.add(comment)
    post.comments_count += 1
    session.add(post)
    session.commit()
    session.refresh(comment)

    user = session.get(User, current_user)
    return {
        "id": comment.id, "content": comment.content,
        "author": _user_summary(user),
        "created_at": str(comment.created_at),
    }


@router.delete("/posts/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: int,
    comment_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    comment = session.get(PostComment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user:
        raise HTTPException(status_code=403, detail="Not your comment")

    post = session.get(Post, post_id)
    if post and post.comments_count > 0:
        post.comments_count -= 1
        session.add(post)

    session.delete(comment)
    session.commit()
    return {"ok": True}
