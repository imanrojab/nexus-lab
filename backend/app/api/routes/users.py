"""
User routes — profile management.
Vulnerabilities:
- Easy: IDOR on GET /api/users/{id} (no ownership check, exposes all fields)
- Easy: IDOR on GET /api/users/{id}/api-key (view anyone's API key)
- Medium: Mass assignment on PATCH /api/users/{id} (can set role field)
- Medium: Stored XSS via bio/full_name (no sanitization)
- Hard: User enumeration via timing on GET /api/users/search
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import Optional

from app.db.database import get_session
from app.models.user import User
from app.core.security import get_current_user_id

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None
    is_private: Optional[bool] = None  # toggle account privacy
    # VULN (Medium): role field accepted — mass assignment
    role: Optional[str] = None


# VULN (Easy): IDOR — any authenticated user can view any profile with all details
@router.get("/{user_id}")
def get_user(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "bio": user.bio,
        "role": user.role,
        "department": user.department,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "is_private": user.is_private,
        "default_org_id": user.default_org_id,
        "followers_count": user.followers_count,
        "following_count": user.following_count,
        "posts_count": user.posts_count,
        "last_login": user.last_login,
        "created_at": str(user.created_at),
    }


# VULN (Easy): IDOR — anyone can view anyone's API key
@router.get("/{user_id}/api-key")
def get_api_key(
    user_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user_id": user.id, "api_key": user.api_key}


# VULN (Medium): Mass assignment — role field is accepted and applied
# VULN (Medium): IDOR — can update any user's profile
# VULN (Medium): Stored XSS — bio and full_name not sanitized
@router.patch("/{user_id}")
def update_user(
    user_id: int,
    body: UpdateProfileRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    session.add(user)
    session.commit()
    session.refresh(user)
    return {
        "id": user.id, "username": user.username, "email": user.email,
        "full_name": user.full_name, "bio": user.bio, "role": user.role,
        "department": user.department, "phone": user.phone,
        "avatar_url": user.avatar_url,
    }


@router.get("")
def list_users(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    offset = (page - 1) * limit
    users = session.exec(
        select(User).order_by(User.id).offset(offset).limit(limit)
    ).all()
    return {
        "items": [
            {
                "id": u.id, "username": u.username, "full_name": u.full_name,
                "email": u.email, "role": u.role, "department": u.department,
                "avatar_url": u.avatar_url, "is_active": u.is_active,
            }
            for u in users
        ],
        "page": page,
        "limit": limit,
    }


# VULN (Easy): SQL Injection via search query parameter
@router.get("/search/query")
def search_users(
    q: str = Query(default=""),
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    if not q:
        return {"results": []}

    import sqlite3
    from app.core.config import DATA_DIR
    conn = sqlite3.connect(str(DATA_DIR / "lab.db"))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    # VULN: Direct string interpolation — SQL injection
    query = f"SELECT id, username, full_name, email, role, department FROM users WHERE username LIKE '%{q}%' OR full_name LIKE '%{q}%' OR email LIKE '%{q}%'"
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        results = [dict(r) for r in rows]
    except Exception as e:
        # VULN (Easy): Verbose SQL error exposed to client
        results = []
        conn.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    conn.close()
    return {"results": results, "query": q}
