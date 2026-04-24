"""
Internal models — password reset, credits, coupons.
Used by internal tools and advanced vulnerability scenarios.
"""
from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class PasswordResetToken(SQLModel, table=True):
    __tablename__ = "password_reset_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True)
    token: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    used: bool = False  # VULN: not invalidated after use


class CreditWallet(SQLModel, table=True):
    __tablename__ = "credit_wallets"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(index=True, unique=True)
    balance: float = 100.0  # starting credits


class Coupon(SQLModel, table=True):
    __tablename__ = "coupons"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    discount: float = 25.0
    max_uses: int = 1
    used_count: int = 0
    is_active: bool = True
