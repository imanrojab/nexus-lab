from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = ""
    description: str = Field(default="", sa_column=Column(Text))
    org_id: int = Field(default=0, index=True)  # scoped to organization
    owner_id: int = 0
    status: str = "active"          # active | archived | draft
    visibility: str = "private"     # public | private | internal
    budget: float = 0.0
    deadline: str = ""
    category: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: int = 0
    title: str = ""
    description: str = Field(default="", sa_column=Column(Text))
    assigned_to: int = 0
    created_by: int = 0
    status: str = "todo"            # todo | in_progress | review | done
    priority: str = "medium"        # low | medium | high | critical
    due_date: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Comment(SQLModel, table=True):
    __tablename__ = "comments"

    id: Optional[int] = Field(default=None, primary_key=True)
    task_id: int = 0
    user_id: int = 0
    content: str = Field(default="", sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
