"""
Feedback & Notification routes.
Vulnerabilities:
- Easy: Blind XSS — feedback message rendered by admin without sanitization
- Medium: IDOR — view/resolve any feedback by ID
- Medium: Stored XSS in notification message (rendered with innerHTML on frontend)
- Hard: Blind XSS — subject field rendered in admin email notification
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional

from app.db.database import get_session
from app.models.feedback import Feedback, Notification
from app.core.security import get_current_user_id, require_admin

router = APIRouter(prefix="/api", tags=["feedback"])


class CreateFeedbackRequest(BaseModel):
    subject: str
    message: str
    category: str = "general"


class ResolveFeedbackRequest(BaseModel):
    status: str = "resolved"
    admin_notes: str = ""


# ── Feedback ────────────────────────────────────────────────────────────────

# VULN (Easy/Medium): Blind XSS — message and subject stored and rendered by admin
@router.post("/feedback")
def submit_feedback(
    body: CreateFeedbackRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    fb = Feedback(
        user_id=current_user,
        subject=body.subject,
        message=body.message,
        category=body.category,
    )
    session.add(fb)
    session.commit()
    session.refresh(fb)
    return {"id": fb.id, "status": "submitted", "message": "Thank you for your feedback!"}


@router.get("/feedback")
def list_feedback(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    status: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    # Scoped: only show feedback submitted by the current user
    q = select(Feedback).where(Feedback.user_id == current_user)
    count_q = select(func.count(Feedback.id)).where(Feedback.user_id == current_user)
    if status:
        q = q.where(Feedback.status == status)
        count_q = count_q.where(Feedback.status == status)

    total: int = session.exec(count_q).one()
    offset = (page - 1) * limit
    items = session.exec(q.order_by(Feedback.created_at.desc()).offset(offset).limit(limit)).all()

    return {
        "items": [
            {
                "id": f.id, "user_id": f.user_id, "subject": f.subject,
                "message": f.message, "category": f.category,
                "status": f.status, "admin_notes": f.admin_notes,
                "created_at": str(f.created_at),
            }
            for f in items
        ],
        "total": total, "page": page, "limit": limit,
    }


# VULN (Medium): IDOR — feedback detail accessible by any user
@router.get("/feedback/{feedback_id}")
def get_feedback(
    feedback_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    fb = session.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    return {
        "id": fb.id, "user_id": fb.user_id, "subject": fb.subject,
        "message": fb.message, "category": fb.category,
        "status": fb.status, "admin_notes": fb.admin_notes,
        "created_at": str(fb.created_at),
    }


@router.patch("/feedback/{feedback_id}")
def resolve_feedback(
    feedback_id: int,
    body: ResolveFeedbackRequest,
    session: Session = Depends(get_session),
    admin_id: int = Depends(require_admin),
):
    fb = session.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    fb.status = body.status
    fb.admin_notes = body.admin_notes
    session.add(fb)
    session.commit()
    return {"id": fb.id, "status": fb.status}


# ── Notifications ───────────────────────────────────────────────────────────

@router.get("/notifications")
def list_notifications(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    notifs = session.exec(
        select(Notification)
        .where(Notification.user_id == current_user)
        .order_by(Notification.created_at.desc())
    ).all()

    return {
        "items": [
            {
                "id": n.id, "title": n.title, "message": n.message,
                "link": n.link, "is_read": n.is_read,
                "created_at": str(n.created_at),
            }
            for n in notifs
        ],
        "unread_count": sum(1 for n in notifs if not n.is_read),
    }


@router.patch("/notifications/{notif_id}/read")
def mark_read(
    notif_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    notif = session.get(Notification, notif_id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    session.add(notif)
    session.commit()
    return {"ok": True}
