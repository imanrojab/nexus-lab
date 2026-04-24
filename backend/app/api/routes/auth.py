"""
Authentication routes.
Vulnerabilities embedded:
- Easy: verbose error messages, no rate limiting, weak passwords accepted
- Easy: account lockout bypass via username case variation
- Medium: JWT role claim trusted without DB check (privilege escalation)
- Medium: Password reset token not invalidated after use
- Medium: 2FA bypass — direct endpoint access after login
- Medium: 2FA brute force — no rate limit on code verification
- Medium: OAuth CSRF — missing state parameter
- Medium: Sensitive data in JWT payload
- Hard: JWT secret is weak/guessable, no token revocation
- Hard: Password reset poisoning via Host header
- Hard: OAuth redirect URI bypass (prefix check only)
"""
import hashlib
import secrets
import random
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.db.database import get_session
from app.models.user import User
from app.models.internal import PasswordResetToken
from app.core.security import verify_password, create_access_token, get_current_user_id

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    full_name: str = ""


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class Verify2FARequest(BaseModel):
    code: str


# VULN (Easy): Verbose error — reveals whether username exists
@router.post("/login")
def login(body: LoginRequest, session: Session = Depends(get_session)):
    # Allow login with username or email
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user:
        user = session.exec(select(User).where(User.email == body.username)).first()
    if not user:
        raise HTTPException(status_code=401, detail=f"User '{body.username}' not found")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password for this account")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # VULN (Medium): Sensitive data embedded in JWT payload (PII in claims)
    token = create_access_token(user.id, user.role, extra={
        "email": user.email,
        "username": user.username,
        "department": user.department,
        "org_id": user.default_org_id,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "avatar_url": user.avatar_url,
            "is_private": user.is_private,
            "default_org_id": user.default_org_id,
        },
    }


# VULN (Easy): No password strength validation, no email verification
@router.post("/register")
def register(body: RegisterRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.username == body.username)).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Username '{body.username}' is already taken")

    from app.core.security import hash_password
    from app.models.organization import Organization, OrgMembership
    import secrets

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        role="user",
        api_key=secrets.token_hex(24),
    )
    session.add(user)
    session.flush()

    # Auto-create personal workspace
    slug = body.username.lower().replace(" ", "-")
    org = Organization(
        name=f"{body.full_name or body.username}'s Workspace",
        slug=f"{slug}-workspace",
        description="Personal workspace",
        owner_id=user.id,
        plan="free",
    )
    session.add(org)
    session.flush()

    membership = OrgMembership(org_id=org.id, user_id=user.id, role="owner")
    session.add(membership)

    user.default_org_id = org.id
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user.id, user.role)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "default_org_id": user.default_org_id,
        },
    }


@router.get("/me")
def get_me(
    user_id: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "bio": user.bio,
        "role": user.role,
        "department": user.department,
        "avatar_url": user.avatar_url,
        "created_at": str(user.created_at),
    }


# ── Password Reset ────────────────────────────────────────────────────────────

# VULN (Medium): Weak reset token (MD5 of email + timestamp)
# VULN (Hard): Reset link uses Host header — poisoning attack
@router.post("/forgot-password")
def forgot_password(
    body: ForgotPasswordRequest,
    request: Request,
    session: Session = Depends(get_session),
):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if not user:
        # VULN (Easy): Reveals whether email exists
        raise HTTPException(status_code=404, detail=f"No account found with email '{body.email}'")

    # VULN: Weak token — MD5(email + timestamp) is predictable
    timestamp = str(int(datetime.utcnow().timestamp()))
    token = hashlib.md5(f"{body.email}{timestamp}".encode()).hexdigest()

    reset = PasswordResetToken(user_id=user.id, token=token)
    session.add(reset)
    session.commit()

    # VULN (Hard): Host header used in reset link — attacker can set Host to evil.com
    host = request.headers.get("host", "localhost:9000")
    reset_link = f"http://{host}/reset-password?token={token}"

    return {
        "message": "Password reset link sent to your email",
        "debug_link": reset_link,  # VULN: Exposes the link directly
        "debug_token": token,      # VULN: Exposes the token
    }


# VULN (Medium): Token not invalidated after use — can be reused
@router.post("/reset-password")
def reset_password(
    body: ResetPasswordRequest,
    session: Session = Depends(get_session),
):
    reset = session.exec(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    ).first()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    # VULN: Token marked as used but still accepted (check is on token existence, not used flag)
    # Also no expiry check — tokens never expire
    user = session.get(User, reset.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from app.core.security import hash_password
    user.password_hash = hash_password(body.new_password)
    reset.used = True  # Marked but never checked
    session.add(user)
    session.add(reset)
    session.commit()

    return {"message": "Password reset successfully"}


# ── Two-Factor Authentication ─────────────────────────────────────────────────

# Stored in-memory for simplicity (VULN: not database-backed, cleartext codes)
_2fa_codes: dict[int, str] = {}
_2fa_verified: dict[int, bool] = {}

@router.post("/setup-2fa")
def setup_2fa(
    user_id: int = Depends(get_current_user_id),
):
    """Generate a 2FA code for the user."""
    # VULN: Simple 4-digit code — only 10,000 possibilities
    code = f"{random.randint(0, 9999):04d}"
    _2fa_codes[user_id] = code
    _2fa_verified[user_id] = False

    return {
        "message": "2FA code generated. Use /api/auth/verify-2fa to verify.",
        "debug_code": code,  # VULN: Code exposed in response
    }


# VULN (Medium): No rate limit on 2FA verification — brute force 10,000 codes
# VULN (Medium): 2FA bypass — protected endpoints don't check 2fa_verified
@router.post("/verify-2fa")
def verify_2fa(
    body: Verify2FARequest,
    user_id: int = Depends(get_current_user_id),
):
    stored_code = _2fa_codes.get(user_id)
    if not stored_code:
        raise HTTPException(status_code=400, detail="2FA not set up. Call /api/auth/setup-2fa first")

    if body.code != stored_code:
        # VULN: No attempt counter, no lockout, no delay
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    _2fa_verified[user_id] = True
    return {"message": "2FA verified successfully", "verified": True}


@router.get("/2fa-status")
def get_2fa_status(user_id: int = Depends(get_current_user_id)):
    return {
        "enabled": user_id in _2fa_codes,
        "verified": _2fa_verified.get(user_id, False),
    }


# ── OAuth Simulation ──────────────────────────────────────────────────────────

_oauth_codes: dict[str, dict] = {}  # code -> {user_id, redirect_uri}

# VULN (Hard): Redirect URI validated with startswith() — bypassable
# VULN (Medium): No state parameter — CSRF on OAuth flow
@router.get("/oauth/authorize")
def oauth_authorize(
    client_id: str = Query(default="nexuscloud-app"),
    redirect_uri: str = Query(default="http://localhost:9001/oauth/callback"),
    response_type: str = Query(default="code"),
    state: str = Query(default=""),  # VULN: Optional, never validated
    user_id: int = Depends(get_current_user_id),
):
    """Simulate OAuth authorization endpoint."""
    allowed_prefix = "http://localhost:9001"

    # VULN (Hard): startswith check — bypassed with:
    # http://localhost:9001.evil.com/steal
    # http://localhost:9001@evil.com/steal
    if not redirect_uri.startswith(allowed_prefix):
        raise HTTPException(status_code=400, detail="Invalid redirect_uri")

    code = secrets.token_urlsafe(16)
    _oauth_codes[code] = {"user_id": user_id, "redirect_uri": redirect_uri}

    return {
        "authorization_code": code,
        "redirect_to": f"{redirect_uri}?code={code}&state={state}",
    }


@router.get("/oauth/callback")
def oauth_callback(
    code: str = Query(default=""),
    state: str = Query(default=""),  # VULN: Never verified against session
):
    """OAuth callback — exchanges code for token."""
    if code not in _oauth_codes:
        raise HTTPException(status_code=400, detail="Invalid authorization code")

    data = _oauth_codes.pop(code)
    token = create_access_token(data["user_id"], "user")

    return {
        "access_token": token,
        "token_type": "bearer",
        "state": state,  # VULN: Echoed back without validation
    }
