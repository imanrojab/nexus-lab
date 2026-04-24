from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text


class Feedback(SQLModel, table=True):
    __tablename__ = "feedbacks"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = 0
    subject: str = ""
    message: str = Field(default="", sa_column=Column(Text))
    category: str = "general"       # general | bug | feature | complaint
    status: str = "unread"          # unread | read | resolved
    admin_notes: str = Field(default="", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(SQLModel, table=True):
    __tablename__ = "notifications"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = 0
    title: str = ""
    message: str = Field(default="", sa_column=Column(Text))
    link: str = ""
    is_read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = 0
    action: str = ""
    resource: str = ""
    resource_id: str = ""
    ip_address: str = ""
    user_agent: str = ""
    details: str = Field(default="", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
