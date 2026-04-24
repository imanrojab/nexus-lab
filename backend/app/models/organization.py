"""
Organization / Workspace models.
Multi-tenant isolation: each org has its own projects, files, and team.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Organization(SQLModel, table=True):
    __tablename__ = "organization"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    slug: str = Field(unique=True, index=True)
    description: str = ""
    logo_url: str = ""
    industry: str = ""
    website: str = ""
    plan: str = "free"  # free, pro, enterprise
    owner_id: int = Field(index=True)
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OrgMembership(SQLModel, table=True):
    __tablename__ = "orgmembership"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(index=True)
    user_id: int = Field(index=True)
    role: str = "member"  # owner, admin, member
    invited_by: Optional[int] = None
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class OrgInvite(SQLModel, table=True):
    __tablename__ = "orginvite"

    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(index=True)
    email: str
    role: str = "member"
    token: str = Field(index=True)
    invited_by: int
    status: str = "pending"  # pending, accepted, expired
    created_at: datetime = Field(default_factory=datetime.utcnow)
