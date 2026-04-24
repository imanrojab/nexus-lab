"""
Organization routes — workspace management.
Vulnerabilities:
- Easy: IDOR on org details — any user can view any org's internal data
- Medium: IDOR on member list — view members of orgs you don't belong to
- Medium: Invite token predictable / no expiry validation
- Hard: No rate limit on invite — spam invites to enumerate emails
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional
import secrets

from app.db.database import get_session
from app.models.organization import Organization, OrgMembership, OrgInvite
from app.models.user import User
from app.core.security import get_current_user_id

router = APIRouter(prefix="/api/orgs", tags=["organizations"])


class CreateOrgRequest(BaseModel):
    name: str
    description: str = ""
    industry: str = ""
    website: str = ""


class UpdateOrgRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None


class InviteMemberRequest(BaseModel):
    email: str
    role: str = "member"


class UpdateMemberRoleRequest(BaseModel):
    role: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_user_org_ids(user_id: int, session: Session) -> list[int]:
    memberships = session.exec(
        select(OrgMembership.org_id).where(OrgMembership.user_id == user_id)
    ).all()
    return list(memberships)


def _require_org_member(user_id: int, org_id: int, session: Session) -> OrgMembership:
    membership = session.exec(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id,
            OrgMembership.user_id == user_id,
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this organization")
    return membership


def _require_org_admin(user_id: int, org_id: int, session: Session) -> OrgMembership:
    membership = _require_org_member(user_id, org_id, session)
    if membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return membership


# ── List my orgs ───────────────────────────────────────────────────────────────

@router.get("")
def list_my_orgs(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    memberships = session.exec(
        select(OrgMembership).where(OrgMembership.user_id == current_user)
    ).all()

    items = []
    for m in memberships:
        org = session.get(Organization, m.org_id)
        if not org:
            continue
        member_count = session.exec(
            select(func.count(OrgMembership.id)).where(OrgMembership.org_id == org.id)
        ).one()
        items.append({
            "id": org.id, "name": org.name, "slug": org.slug,
            "description": org.description, "logo_url": org.logo_url,
            "plan": org.plan, "industry": org.industry,
            "my_role": m.role, "member_count": member_count,
            "created_at": str(org.created_at),
        })

    return {"items": items}


# VULN (Easy): IDOR — any user can view any org details
@router.get("/{org_id}")
def get_org(
    org_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    owner = session.get(User, org.owner_id)
    member_count = session.exec(
        select(func.count(OrgMembership.id)).where(OrgMembership.org_id == org_id)
    ).one()

    return {
        "id": org.id, "name": org.name, "slug": org.slug,
        "description": org.description, "logo_url": org.logo_url,
        "plan": org.plan, "industry": org.industry, "website": org.website,
        "owner": {"id": owner.id, "full_name": owner.full_name, "email": owner.email} if owner else None,
        "member_count": member_count,
        "created_at": str(org.created_at),
    }


@router.post("")
def create_org(
    body: CreateOrgRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    slug = body.name.lower().replace(" ", "-").replace("_", "-")
    existing = session.exec(select(Organization).where(Organization.slug == slug)).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Organization slug '{slug}' already taken")

    org = Organization(
        name=body.name, slug=slug, description=body.description,
        industry=body.industry, website=body.website, owner_id=current_user,
    )
    session.add(org)
    session.flush()

    membership = OrgMembership(org_id=org.id, user_id=current_user, role="owner")
    session.add(membership)
    session.commit()
    session.refresh(org)

    return {"id": org.id, "name": org.name, "slug": org.slug}


@router.patch("/{org_id}")
def update_org(
    org_id: int,
    body: UpdateOrgRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    _require_org_admin(current_user, org_id, session)
    org = session.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(org, key, value)
    session.add(org)
    session.commit()
    session.refresh(org)
    return {"id": org.id, "name": org.name, "slug": org.slug}


# ── Members ────────────────────────────────────────────────────────────────────

# VULN (Medium): IDOR — any user can list members of any org
@router.get("/{org_id}/members")
def list_members(
    org_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    memberships = session.exec(
        select(OrgMembership).where(OrgMembership.org_id == org_id)
    ).all()

    items = []
    for m in memberships:
        user = session.get(User, m.user_id)
        if not user:
            continue
        items.append({
            "id": user.id, "username": user.username, "email": user.email,
            "full_name": user.full_name, "avatar_url": user.avatar_url,
            "department": user.department, "role": m.role,
            "joined_at": str(m.joined_at),
        })

    return {"items": items, "org_id": org_id}


@router.post("/{org_id}/invite")
def invite_member(
    org_id: int,
    body: InviteMemberRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    _require_org_admin(current_user, org_id, session)

    token = secrets.token_urlsafe(32)
    invite = OrgInvite(
        org_id=org_id, email=body.email, role=body.role,
        token=token, invited_by=current_user,
    )
    session.add(invite)
    session.commit()
    session.refresh(invite)

    return {"invite_id": invite.id, "token": token, "email": body.email}


@router.post("/{org_id}/join")
def join_org_via_invite(
    org_id: int,
    token: str,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    # VULN: No expiry check on invite token
    invite = session.exec(
        select(OrgInvite).where(
            OrgInvite.org_id == org_id,
            OrgInvite.token == token,
            OrgInvite.status == "pending",
        )
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or expired invite")

    existing = session.exec(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id, OrgMembership.user_id == current_user
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already a member")

    membership = OrgMembership(
        org_id=org_id, user_id=current_user, role=invite.role,
        invited_by=invite.invited_by,
    )
    session.add(membership)

    invite.status = "accepted"
    session.add(invite)
    session.commit()

    return {"ok": True, "org_id": org_id, "role": invite.role}


@router.patch("/{org_id}/members/{user_id}")
def update_member_role(
    org_id: int,
    user_id: int,
    body: UpdateMemberRoleRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    _require_org_admin(current_user, org_id, session)

    membership = session.exec(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id, OrgMembership.user_id == user_id
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")

    membership.role = body.role
    session.add(membership)
    session.commit()

    return {"user_id": user_id, "role": body.role}


@router.delete("/{org_id}/members/{user_id}")
def remove_member(
    org_id: int,
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    _require_org_admin(current_user, org_id, session)

    membership = session.exec(
        select(OrgMembership).where(
            OrgMembership.org_id == org_id, OrgMembership.user_id == user_id
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found")
    if membership.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    session.delete(membership)
    session.commit()
    return {"ok": True}
