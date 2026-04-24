"""
Admin routes.
Vulnerabilities:
- Easy: Debug endpoint exposes config, environment variables, DB path
- Medium: Admin check based on JWT claim only (forgeable with known secret)
- Medium: SSRF via webhook test endpoint
- Hard: Command injection via export format parameter
- Hard: Insecure deserialization via settings import
"""
import os
import subprocess
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional

import httpx

from app.db.database import get_session
from app.models.user import User
from app.models.project import Project, Task
from app.models.feedback import Feedback, AuditLog
from app.core.security import require_admin, get_current_user_id
from app.core.config import APP_NAME, APP_VERSION, DATABASE_URL, DATA_DIR, JWT_SECRET

router = APIRouter(prefix="/api/admin", tags=["admin"])


class WebhookTestRequest(BaseModel):
    url: str
    method: str = "GET"
    headers: dict = {}
    body: str = ""


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    department: Optional[str] = None


# ── Dashboard Stats ─────────────────────────────────────────────────────────

@router.get("/stats")
def admin_stats(
    session: Session = Depends(get_session),
    admin_id: int = Depends(require_admin),
):
    total_users: int = session.exec(select(func.count(User.id))).one()
    total_projects: int = session.exec(select(func.count(Project.id))).one()
    total_tasks: int = session.exec(select(func.count(Task.id))).one()
    open_feedback: int = session.exec(
        select(func.count(Feedback.id)).where(Feedback.status == "unread")
    ).one()

    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "total_tasks": total_tasks,
        "open_feedback": open_feedback,
    }


# VULN (Easy): Debug endpoint exposes sensitive configuration
@router.get("/debug")
def debug_info(admin_id: int = Depends(require_admin)):
    return {
        "app_name": APP_NAME,
        "app_version": APP_VERSION,
        "database_url": DATABASE_URL,
        "data_dir": str(DATA_DIR),
        "jwt_secret": JWT_SECRET,
        "python_version": os.sys.version,
        "environment": dict(os.environ),
        "cwd": os.getcwd(),
    }


@router.get("/users")
def admin_list_users(
    session: Session = Depends(get_session),
    admin_id: int = Depends(require_admin),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    offset = (page - 1) * limit
    total: int = session.exec(select(func.count(User.id))).one()
    users = session.exec(select(User).order_by(User.id).offset(offset).limit(limit)).all()

    return {
        "items": [
            {
                "id": u.id, "username": u.username, "email": u.email,
                "full_name": u.full_name, "role": u.role, "department": u.department,
                "is_active": u.is_active, "api_key": u.api_key,
                "last_login": u.last_login, "created_at": str(u.created_at),
            }
            for u in users
        ],
        "total": total, "page": page, "limit": limit,
    }


@router.patch("/users/{user_id}")
def admin_update_user(
    user_id: int,
    body: UserUpdateRequest,
    session: Session = Depends(get_session),
    admin_id: int = Depends(require_admin),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.department is not None:
        user.department = body.department

    session.add(user)
    session.commit()
    session.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}


# VULN (Medium): SSRF — server makes request to user-supplied URL
@router.post("/webhook-test")
def test_webhook(
    body: WebhookTestRequest,
    admin_id: int = Depends(require_admin),
):
    try:
        if body.method.upper() == "POST":
            resp = httpx.post(body.url, headers=body.headers, content=body.body, timeout=10, follow_redirects=True)
        else:
            resp = httpx.get(body.url, headers=body.headers, timeout=10, follow_redirects=True)

        return {
            "status_code": resp.status_code,
            "headers": dict(resp.headers),
            "body": resp.text[:5000],
            "url": str(resp.url),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Webhook test failed: {str(e)}")


# VULN (Hard): Command injection via export format
@router.get("/export")
def export_data(
    format: str = Query(default="json"),
    resource: str = Query(default="users"),
    admin_id: int = Depends(require_admin),
):
    db_path = str(DATA_DIR / "lab.db")

    if format == "json":
        from sqlmodel import Session as S
        from app.db.database import engine
        with S(engine) as session:
            if resource == "users":
                users = session.exec(select(User)).all()
                return {"data": [{"id": u.id, "username": u.username, "email": u.email, "role": u.role} for u in users]}
            elif resource == "projects":
                projects = session.exec(select(Project)).all()
                return {"data": [{"id": p.id, "name": p.name, "status": p.status} for p in projects]}
    else:
        # VULN: Command injection — format parameter injected into shell command
        cmd = f"sqlite3 {db_path} '.mode {format}' '.headers on' 'SELECT * FROM {resource};'"
        try:
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
            return {"output": result.stdout, "error": result.stderr}
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=504, detail="Export timed out")


# ── Audit Log ───────────────────────────────────────────────────────────────

@router.get("/audit-logs")
def list_audit_logs(
    session: Session = Depends(get_session),
    admin_id: int = Depends(require_admin),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
):
    offset = (page - 1) * limit
    total: int = session.exec(select(func.count(AuditLog.id))).one()
    logs = session.exec(
        select(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    ).all()

    return {
        "items": [
            {
                "id": l.id, "user_id": l.user_id, "action": l.action,
                "resource": l.resource, "resource_id": l.resource_id,
                "ip_address": l.ip_address, "details": l.details,
                "created_at": str(l.created_at),
            }
            for l in logs
        ],
        "total": total, "page": page, "limit": limit,
    }
