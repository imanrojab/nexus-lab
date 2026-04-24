"""
File upload routes — org-scoped.
Vulnerabilities:
- Easy: No file type validation — can upload .php, .jsp, .html, etc.
- Medium: Path traversal in filename — can write outside upload dir
- Medium: IDOR — download/delete any file by ID without org membership check
- Hard: No size limit, no content-type verification against actual content
"""
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Query
from fastapi.responses import FileResponse
from sqlmodel import Session, select, func

from app.db.database import get_session
from app.models.file import UploadedFile
from app.models.user import User
from app.models.organization import OrgMembership
from app.core.security import get_current_user_id
from app.core.config import UPLOAD_DIR

router = APIRouter(prefix="/api/files", tags=["files"])

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _get_user_org_ids(user_id: int, session: Session) -> list[int]:
    return list(session.exec(
        select(OrgMembership.org_id).where(OrgMembership.user_id == user_id)
    ).all())


# VULN (Easy): No file type restriction — any file type accepted
# VULN (Medium): Filename used as-is — path traversal possible
@router.post("/upload")
async def upload_file(
    file: UploadFile,
    project_id: int = Query(default=0),
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    # VULN: Using original filename directly (path traversal)
    filename = file.filename or "unknown"
    file_path = UPLOAD_DIR / filename

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    user = session.get(User, current_user)
    org_id = user.default_org_id if user else 0

    db_file = UploadedFile(
        filename=filename,
        original_name=file.filename or "",
        content_type=file.content_type or "",
        size=len(content),
        org_id=org_id,
        project_id=project_id,
        uploaded_by=current_user,
        path=str(file_path),
    )
    session.add(db_file)
    session.commit()
    session.refresh(db_file)

    return {
        "id": db_file.id, "filename": db_file.filename,
        "size": db_file.size, "content_type": db_file.content_type,
        "org_id": db_file.org_id, "project_id": db_file.project_id,
    }


# VULN (Easy): IDOR — any user can download any file (cross-org)
@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    db_file = session.get(UploadedFile, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    if not os.path.exists(db_file.path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        db_file.path,
        filename=db_file.original_name,
        media_type=db_file.content_type,
    )


# Scoped: only show files from user's orgs
@router.get("")
def list_files(
    project_id: int = Query(default=None),
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    my_org_ids = _get_user_org_ids(current_user, session)
    q = select(UploadedFile).where(UploadedFile.org_id.in_(my_org_ids))

    if project_id:
        q = q.where(UploadedFile.project_id == project_id)

    files = session.exec(q.order_by(UploadedFile.created_at.desc())).all()

    return {
        "items": [
            {
                "id": f.id, "filename": f.filename, "original_name": f.original_name,
                "content_type": f.content_type, "size": f.size,
                "org_id": f.org_id, "project_id": f.project_id,
                "uploaded_by": f.uploaded_by,
                "created_at": str(f.created_at),
            }
            for f in files
        ]
    }


# VULN (Easy): IDOR — any user can delete any file (cross-org)
@router.delete("/{file_id}")
def delete_file(
    file_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    db_file = session.get(UploadedFile, file_id)
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    if os.path.exists(db_file.path):
        os.remove(db_file.path)

    session.delete(db_file)
    session.commit()
    return {"ok": True}
