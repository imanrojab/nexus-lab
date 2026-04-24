"""
Internal developer tools routes.
These represent "internal" utilities that a SaaS platform might have — each
contains intentional vulnerabilities for security testing practice.

Vulnerabilities:
- Hard: Server-Side Template Injection (Jinja2 render)
- Hard: Python eval() RCE via calculator
- Hard: Unsafe YAML deserialization
- Hard: Pickle deserialization RCE
- Hard: Blind SQL Injection (boolean-based)
- Hard: Second-Order SQL Injection
- Hard: Race condition — coupon double-spend
- Hard: Race condition — TOCTOU balance transfer
- Medium: ORM filter injection
- Medium: CSV formula injection in export
- Medium: CRLF / log injection
- Medium: HTTP parameter pollution
- Medium: ReDoS via catastrophic backtracking
- Medium: Unsigned webhook receiver
- Medium: SSRF via redirect chain
- Medium: SSRF via file:// scheme
- Medium: Blind SSRF via URL preview
- Medium: Negative value price manipulation
- Medium: Inconsistent validation
- Easy: Unbounded query (no max limit)
- Easy: Backup file exposure
- Easy: Force browsing — unprotected endpoints
"""
import os
import re
import csv
import io
import pickle
import base64
import hashlib
import logging
import sqlite3
from datetime import datetime
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import BaseModel
from sqlmodel import Session, select, func

from app.db.database import get_session, engine
from app.models.user import User
from app.models.internal import CreditWallet, Coupon
from app.models.feedback import AuditLog
from app.core.security import get_current_user_id, require_admin
from app.core.config import DATA_DIR, JWT_SECRET

router = APIRouter(prefix="/api/internal", tags=["internal"])
logger = logging.getLogger("nexuscloud.internal")


# ── Request schemas ───────────────────────────────────────────────────────────

class TemplateRenderRequest(BaseModel):
    template: str
    variables: dict = {}


class CalculateRequest(BaseModel):
    expression: str


class YamlImportRequest(BaseModel):
    content: str  # raw YAML string


class PickleImportRequest(BaseModel):
    data: str  # base64-encoded pickle


class TransferRequest(BaseModel):
    to_user_id: int
    amount: float


class CouponRedeemRequest(BaseModel):
    code: str


class WebhookPayload(BaseModel):
    event: str
    order_id: str = ""
    amount: float = 0.0
    status: str = "completed"


class UrlPreviewRequest(BaseModel):
    url: str


class LogActionRequest(BaseModel):
    action: str
    details: str = ""


class MergeConfigRequest(BaseModel):
    config: dict


class ValidateEmailRequest(BaseModel):
    email: str


# ── SSTI — Jinja2 Template Injection ─────────────────────────────────────────

# VULN (Hard): User input rendered directly as Jinja2 template
@router.post("/render-template")
def render_template(
    body: TemplateRenderRequest,
    admin_id: int = Depends(require_admin),
):
    """Render a notification template for preview. Admin only."""
    try:
        from jinja2 import Template
        # VULN: User-supplied string used as template source
        t = Template(body.template)
        result = t.render(**body.variables)
        return {"rendered": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template error: {str(e)}")


# ── eval() RCE — Calculator ──────────────────────────────────────────────────

# VULN (Hard): Python eval() on user input
@router.post("/calculate")
def calculate(
    body: CalculateRequest,
    current_user: int = Depends(get_current_user_id),
):
    """Built-in calculator for project budget formulas."""
    try:
        # VULN: Direct eval of user-supplied expression
        result = eval(body.expression)
        return {"expression": body.expression, "result": str(result)}
    except Exception as e:
        return {"expression": body.expression, "error": str(e)}


# ── Unsafe YAML Deserialization ───────────────────────────────────────────────

# VULN (Hard): yaml.load with FullLoader → yaml.unsafe_load
@router.post("/import-yaml")
def import_yaml(
    body: YamlImportRequest,
    admin_id: int = Depends(require_admin),
):
    """Import configuration from YAML format."""
    try:
        import yaml
        # VULN: Unsafe YAML loader allows arbitrary Python object instantiation
        data = yaml.load(body.content, Loader=yaml.FullLoader)
        return {"imported": True, "keys": list(data.keys()) if isinstance(data, dict) else str(type(data))}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YAML parse error: {str(e)}")


# ── Pickle Deserialization RCE ────────────────────────────────────────────────

# VULN (Hard): pickle.loads on user-supplied data
@router.post("/import-data")
def import_data(
    body: PickleImportRequest,
    admin_id: int = Depends(require_admin),
):
    """Import serialized data (internal migration tool)."""
    try:
        # VULN: Deserializing untrusted pickle data → RCE
        raw = base64.b64decode(body.data)
        obj = pickle.loads(raw)
        return {"imported": True, "type": str(type(obj)), "preview": str(obj)[:500]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Import error: {str(e)}")


# ── Blind SQL Injection (Boolean-Based) ───────────────────────────────────────

# VULN (Hard): Boolean-based blind SQLi via check endpoint
@router.get("/check-exists")
def check_exists(
    table: str = Query(default="users"),
    column: str = Query(default="username"),
    value: str = Query(default=""),
    current_user: int = Depends(get_current_user_id),
):
    """Check if a value exists in the database (availability checker)."""
    db_path = str(DATA_DIR / "lab.db")
    try:
        conn = sqlite3.connect(db_path)
        # VULN: Table, column, and value all injected into raw SQL
        query = f"SELECT COUNT(*) FROM {table} WHERE {column} = '{value}'"
        cursor = conn.execute(query)
        count = cursor.fetchone()[0]
        conn.close()
        return {"exists": count > 0, "table": table, "column": column}
    except Exception as e:
        return {"exists": False, "error": str(e)}


# ── Second-Order SQL Injection ────────────────────────────────────────────────

# VULN (Hard): Stored username used unsafely in admin report query
@router.get("/user-report")
def user_report(
    username: str = Query(default=""),
    admin_id: int = Depends(require_admin),
):
    """Generate activity report for a user (uses stored data in raw query)."""
    db_path = str(DATA_DIR / "lab.db")
    try:
        conn = sqlite3.connect(db_path)
        # VULN: Even though username was safely stored at registration,
        # it's used here in a raw query without parameterization
        query = f"SELECT id, username, email, role, created_at FROM users WHERE username = '{username}'"
        cursor = conn.execute(query)
        rows = cursor.fetchall()
        conn.close()
        return {
            "report": [
                {"id": r[0], "username": r[1], "email": r[2], "role": r[3], "created_at": r[4]}
                for r in rows
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report error: {str(e)}")


# ── ORM Filter Injection ─────────────────────────────────────────────────────

# VULN (Medium): Request params passed directly as filter kwargs
@router.get("/query")
def query_data(
    request: Request,
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Flexible data query endpoint for internal dashboards."""
    params = dict(request.query_params)
    params.pop("token", None)  # remove auth token if passed as query param

    try:
        # VULN: All query params passed as filter kwargs to User model
        # Attacker can filter by password_hash, api_key, etc.
        stmt = select(User)
        for key, value in params.items():
            if hasattr(User, key):
                stmt = stmt.where(getattr(User, key) == value)

        users = session.exec(stmt.limit(50)).all()
        return {
            "items": [
                {"id": u.id, "username": u.username, "email": u.email,
                 "role": u.role, "department": u.department}
                for u in users
            ],
            "filters_applied": list(params.keys()),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── CSV Formula Injection ────────────────────────────────────────────────────

# VULN (Medium): User data exported to CSV without sanitizing formula chars
@router.get("/export-csv")
def export_csv(
    resource: str = Query(default="users"),
    admin_id: int = Depends(require_admin),
    session: Session = Depends(get_session),
):
    """Export data as CSV for spreadsheet import."""
    output = io.StringIO()
    writer = csv.writer(output)

    if resource == "users":
        writer.writerow(["ID", "Username", "Email", "Full Name", "Role", "Bio"])
        users = session.exec(select(User)).all()
        for u in users:
            # VULN: bio, full_name etc. may contain =, +, -, @ which become
            # formulas when opened in Excel/Sheets
            writer.writerow([u.id, u.username, u.email, u.full_name, u.role, u.bio])

    output.seek(0)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={resource}_export.csv"},
    )


# ── CRLF / Log Injection ─────────────────────────────────────────────────────

# VULN (Medium): User input written to logs without newline sanitization
@router.post("/log-action")
def log_action(
    body: LogActionRequest,
    current_user: int = Depends(get_current_user_id),
):
    """Log a user action for auditing."""
    # VULN: No sanitization of newlines — attacker can forge log entries
    logger.info(f"[USER:{current_user}] Action: {body.action} | Details: {body.details}")
    return {"logged": True, "action": body.action}


@router.get("/logs")
def view_logs(
    admin_id: int = Depends(require_admin),
    lines: int = Query(default=100, ge=1, le=1000),
):
    """View recent application logs."""
    log_path = DATA_DIR / "app.log"
    if not log_path.exists():
        return {"lines": [], "total": 0}
    with open(log_path, "r") as f:
        all_lines = f.readlines()
    return {"lines": all_lines[-lines:], "total": len(all_lines)}


# ── HTTP Parameter Pollution ──────────────────────────────────────────────────

# VULN (Medium): Duplicate params — first used for auth check, last for data
@router.get("/resource")
def get_resource(
    request: Request,
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Get resource by ID. Supports multi-value params."""
    ids = request.query_params.getlist("id")
    if not ids:
        raise HTTPException(status_code=400, detail="Missing id parameter")

    # VULN: Auth logic could check ids[0], data retrieval uses ids[-1]
    # In a real app, the auth middleware might validate access to first ID
    # while the actual query fetches the last ID
    target_id = int(ids[-1])
    user = session.get(User, target_id)
    if not user:
        raise HTTPException(status_code=404, detail="Resource not found")

    return {
        "id": user.id, "username": user.username, "email": user.email,
        "role": user.role, "department": user.department,
        "params_received": ids,
    }


# ── ReDoS — Catastrophic Backtracking ────────────────────────────────────────

# VULN (Medium): Evil regex with catastrophic backtracking
@router.post("/validate-email")
def validate_email(
    body: ValidateEmailRequest,
    current_user: int = Depends(get_current_user_id),
):
    """Validate email format with strict regex."""
    # VULN: This regex has catastrophic backtracking on inputs like
    # "aaaaaaaaaaaaaaaaaaaaaaaa!" — exponential time
    pattern = r'^([a-zA-Z0-9]+)*@([a-zA-Z0-9]+)*\.([a-zA-Z]{2,})$'
    try:
        match = re.match(pattern, body.email, re.IGNORECASE)
        return {"valid": match is not None, "email": body.email}
    except Exception as e:
        return {"valid": False, "error": str(e)}


# ── Unsigned Webhook Receiver ─────────────────────────────────────────────────

# VULN (Medium): No HMAC signature verification on incoming webhooks
@router.post("/webhook-receive")
def receive_webhook(
    body: WebhookPayload,
    request: Request,
):
    """Receive payment webhook from external provider."""
    # VULN: No signature verification — anyone can send fake payment confirmations
    # A real app would verify X-Webhook-Signature header with HMAC
    if body.event == "payment.completed" and body.status == "completed":
        return {
            "processed": True,
            "event": body.event,
            "order_id": body.order_id,
            "amount": body.amount,
            "message": f"Payment of ${body.amount} for order {body.order_id} confirmed.",
        }
    return {"processed": False, "event": body.event}


# ── SSRF Variants ─────────────────────────────────────────────────────────────

# VULN (Medium): SSRF via URL preview — follows redirects, no scheme restriction
@router.post("/url-preview")
def url_preview(
    body: UrlPreviewRequest,
    current_user: int = Depends(get_current_user_id),
):
    """Generate a link preview (title, description) from URL."""
    try:
        # VULN 1 (Medium): Follows redirects — attacker server can 302 to internal IPs
        # VULN 2 (Medium): No scheme restriction — file:// works
        # VULN 3 (Hard): Only checks literal "127.0.0.1" / "localhost" — bypassed
        #                 with 0x7f000001, 2130706433, 0177.0.0.1, [::1], etc.
        blocked = ["127.0.0.1", "localhost"]
        from urllib.parse import urlparse
        parsed = urlparse(body.url)
        if parsed.hostname in blocked:
            raise HTTPException(status_code=400, detail="Blocked: internal addresses not allowed")

        resp = httpx.get(body.url, timeout=10, follow_redirects=True)
        # Extract title from HTML
        title = ""
        import re as regex
        title_match = regex.search(r"<title>(.*?)</title>", resp.text, regex.IGNORECASE)
        if title_match:
            title = title_match.group(1)

        return {
            "url": body.url,
            "final_url": str(resp.url),
            "status": resp.status_code,
            "title": title,
            "content_type": resp.headers.get("content-type", ""),
            "body_preview": resp.text[:1000],
        }
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {str(e)}")


# ── Race Condition: Coupon Double-Spend ───────────────────────────────────────

# VULN (Hard): No locking on coupon usage — send 10 parallel requests
@router.post("/redeem-coupon")
def redeem_coupon(
    body: CouponRedeemRequest,
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Redeem a discount coupon to add credits."""
    coupon = session.exec(
        select(Coupon).where(Coupon.code == body.code, Coupon.is_active == True)
    ).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found or inactive")

    # VULN: Check-then-act without locking — race window between check and update
    if coupon.used_count >= coupon.max_uses:
        raise HTTPException(status_code=409, detail="Coupon already fully redeemed")

    # Add credits to wallet
    wallet = session.exec(
        select(CreditWallet).where(CreditWallet.user_id == current_user)
    ).first()
    if not wallet:
        wallet = CreditWallet(user_id=current_user, balance=100.0)
        session.add(wallet)
        session.flush()

    wallet.balance += coupon.discount
    coupon.used_count += 1
    session.add(wallet)
    session.add(coupon)
    session.commit()

    return {
        "redeemed": True,
        "discount": coupon.discount,
        "new_balance": wallet.balance,
        "coupon_uses": f"{coupon.used_count}/{coupon.max_uses}",
    }


# ── Race Condition: TOCTOU Balance Transfer ───────────────────────────────────

# VULN (Hard): Time-of-check/time-of-use — double-spend via concurrent transfers
@router.post("/transfer-credits")
def transfer_credits(
    body: TransferRequest,
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Transfer credits to another user."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    sender = session.exec(
        select(CreditWallet).where(CreditWallet.user_id == current_user)
    ).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Wallet not found")

    # VULN: Balance checked here...
    if sender.balance < body.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    receiver = session.exec(
        select(CreditWallet).where(CreditWallet.user_id == body.to_user_id)
    ).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Recipient wallet not found")

    # VULN: ...but deducted later — concurrent requests both pass the check
    sender.balance -= body.amount
    receiver.balance += body.amount
    session.add(sender)
    session.add(receiver)
    session.commit()

    return {
        "transferred": body.amount,
        "to_user_id": body.to_user_id,
        "sender_balance": sender.balance,
    }


# ── Negative Value Manipulation ───────────────────────────────────────────────

# VULN (Medium): No validation on negative amounts in credit purchase
@router.post("/purchase-credits")
def purchase_credits(
    amount: float = Query(default=10.0),
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Purchase additional credits for your wallet."""
    wallet = session.exec(
        select(CreditWallet).where(CreditWallet.user_id == current_user)
    ).first()
    if not wallet:
        wallet = CreditWallet(user_id=current_user, balance=100.0)
        session.add(wallet)
        session.flush()

    # VULN: No check for negative amount — user can "purchase" negative credits
    # which adds credits instead of deducting payment
    wallet.balance += amount
    session.add(wallet)
    session.commit()

    return {"new_balance": wallet.balance, "purchased": amount}


# ── Wallet Balance (for testing) ──────────────────────────────────────────────

@router.get("/wallet")
def get_wallet(
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Get current user's credit wallet balance."""
    wallet = session.exec(
        select(CreditWallet).where(CreditWallet.user_id == current_user)
    ).first()
    if not wallet:
        wallet = CreditWallet(user_id=current_user, balance=100.0)
        session.add(wallet)
        session.commit()
        session.refresh(wallet)
    return {"user_id": current_user, "balance": wallet.balance}


# ── Inconsistent Validation ───────────────────────────────────────────────────

# VULN (Medium): Registration validates email domain but profile update doesn't
@router.post("/update-contact")
def update_contact(
    email: str = Query(default=""),
    phone: str = Query(default=""),
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Quick contact info update (internal shortcut)."""
    user = session.get(User, current_user)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # VULN: No email format validation here, unlike registration
    # Allows setting email to anything: "notanemail", SQL payloads, etc.
    if email:
        user.email = email
    if phone:
        user.phone = phone
    session.add(user)
    session.commit()

    return {"updated": True, "email": user.email, "phone": user.phone}


# ── Unbounded Query ───────────────────────────────────────────────────────────

# VULN (Easy): No upper bound on limit parameter — DoS via huge query
@router.get("/all-data")
def get_all_data(
    resource: str = Query(default="users"),
    limit: int = Query(default=100),  # VULN: no max — limit=999999999
    offset: int = Query(default=0),
    current_user: int = Depends(get_current_user_id),
    session: Session = Depends(get_session),
):
    """Flexible data export for internal dashboards."""
    if resource == "users":
        items = session.exec(select(User).offset(offset).limit(limit)).all()
        return {
            "items": [
                {"id": u.id, "username": u.username, "email": u.email,
                 "full_name": u.full_name, "role": u.role, "api_key": u.api_key,
                 "password_hash": u.password_hash}  # VULN: Excessive data exposure
                for u in items
            ]
        }
    return {"items": []}


# ── Config Backup Exposure ────────────────────────────────────────────────────

# VULN (Easy): Backup files accessible without auth
@router.get("/backup/{filename}")
def get_backup(filename: str):
    """Download configuration backup file."""
    # VULN: No authentication, serves sensitive backup data
    backups = {
        "db.sql.bak": f"-- NexusCloud Database Dump\n-- Generated: {datetime.utcnow()}\n-- JWT_SECRET: {JWT_SECRET}\n\nCREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  username TEXT,\n  email TEXT,\n  password_hash TEXT,\n  role TEXT DEFAULT 'user'\n);\n\nINSERT INTO users VALUES(1,'admin','admin@nexuscloud.io','$2b$12$...','admin');\n",
        "config.bak": f"APP_NAME=NexusCloud\nJWT_SECRET={JWT_SECRET}\nDATABASE_URL=sqlite:///data/lab.db\nSMTP_PASS=mailpass2024!\nAWS_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
        ".env.bak": f"JWT_SECRET={JWT_SECRET}\nDEBUG=true\nSECRET_KEY={JWT_SECRET}\n",
    }
    content = backups.get(filename)
    if not content:
        raise HTTPException(status_code=404, detail="Backup not found")
    return PlainTextResponse(content)


# ── Deep Merge (Server-Side Object Injection) ────────────────────────────────

# VULN (Medium): Server-side prototype-pollution-like via recursive merge
@router.post("/merge-config")
def merge_config(
    body: MergeConfigRequest,
    admin_id: int = Depends(require_admin),
):
    """Merge partial config update into current settings."""
    current_config = {
        "app_name": "NexusCloud",
        "debug": False,
        "max_upload_size": 10485760,
        "features": {"social": True, "files": True, "admin": True},
    }

    def deep_merge(base: dict, override: dict) -> dict:
        for key, value in override.items():
            # VULN: No key sanitization — __class__, __init__, __globals__ accepted
            if isinstance(value, dict) and isinstance(base.get(key), dict):
                base[key] = deep_merge(base[key], value)
            else:
                base[key] = value
        return base

    merged = deep_merge(current_config, body.config)
    return {"config": merged}
