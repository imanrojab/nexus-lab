"""
Social models — posts, comments, likes, follows.
Instagram-style social features with privacy controls.
"""
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class Post(SQLModel, table=True):
    __tablename__ = "post"

    id: Optional[int] = Field(default=None, primary_key=True)
    author_id: int = Field(index=True)
    content: str
    image_url: str = ""
    visibility: str = "public"  # public, private, followers
    likes_count: int = 0
    comments_count: int = 0
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class PostComment(SQLModel, table=True):
    __tablename__ = "postcomment"

    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(index=True)
    user_id: int = Field(index=True)
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PostLike(SQLModel, table=True):
    __tablename__ = "postlike"

    id: Optional[int] = Field(default=None, primary_key=True)
    post_id: int = Field(index=True)
    user_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Follow(SQLModel, table=True):
    __tablename__ = "follow"

    id: Optional[int] = Field(default=None, primary_key=True)
    follower_id: int = Field(index=True)
    following_id: int = Field(index=True)
    status: str = "accepted"  # pending (for private accounts), accepted
    created_at: datetime = Field(default_factory=datetime.utcnow)
