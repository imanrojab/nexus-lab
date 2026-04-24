from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)
    email: str = Field(index=True)
    password_hash: str = ""
    full_name: str = ""
    bio: str = Field(default="", sa_column=Column(Text))
    avatar_url: str = ""
    role: str = "user"              # admin | manager | user | guest
    department: str = ""
    phone: str = ""
    api_key: str = ""               # personal API key
    is_active: bool = True
    is_private: bool = False        # private account (followers must request)
    default_org_id: int = 0         # user's primary organization
    last_login: Optional[str] = None
    followers_count: int = 0
    following_count: int = 0
    posts_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
