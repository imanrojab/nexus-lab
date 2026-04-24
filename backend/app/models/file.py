from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class UploadedFile(SQLModel, table=True):
    __tablename__ = "files"

    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str = ""
    original_name: str = ""
    content_type: str = ""
    size: int = 0
    org_id: int = Field(default=0, index=True)  # scoped to organization
    project_id: int = 0
    uploaded_by: int = 0
    path: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
