from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import APP_NAME, APP_VERSION, CORS_ORIGINS, UPLOAD_DIR
from app.db.init_db import init_db
from app.api.routes import auth, users, projects, files, feedback, admin, organizations, social, follows
from app.api.routes import internal


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


# VULN (Easy): OpenAPI docs exposed in production — /docs and /openapi.json accessible
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="NexusCloud — Enterprise Project Management Platform",
    lifespan=lifespan,
    # VULN: docs_url and redoc_url not disabled in production
)


# VULN (Medium): X-HTTP-Method-Override middleware — bypass method-based access controls
class MethodOverrideMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        override = request.headers.get("x-http-method-override")
        if override:
            request.scope["method"] = override.upper()
        response = await call_next(request)
        return response


app.add_middleware(MethodOverrideMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# VULN (Medium): Missing security headers — no CSP, HSTS, X-Frame-Options, etc.
# A proper app would add these via middleware:
# @app.middleware("http")
# async def add_security_headers(request, call_next):
#     response = await call_next(request)
#     response.headers["X-Content-Type-Options"] = "nosniff"
#     response.headers["X-Frame-Options"] = "DENY"
#     response.headers["Content-Security-Policy"] = "default-src 'self'"
#     response.headers["Strict-Transport-Security"] = "max-age=31536000"
#     return response
# ^^^ intentionally NOT added — missing security headers is the vuln


# Static files for uploads
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(organizations.router)
app.include_router(projects.router)
app.include_router(files.router)
app.include_router(feedback.router)
app.include_router(social.router)
app.include_router(follows.router)
app.include_router(admin.router)
app.include_router(internal.router)


# VULN (Easy): Health endpoint exposes server info
@app.get("/api/health", tags=["health"])
def health():
    return {
        "status": "ok",
        "app": APP_NAME,
        "version": APP_VERSION,
        "server": "FastAPI/Uvicorn",
        "python": "3.13",
    }


# VULN (Easy): Robots.txt reveals hidden paths
@app.get("/robots.txt")
def robots():
    return {
        "content": "User-agent: *\nDisallow: /api/admin/\nDisallow: /api/admin/debug\nDisallow: /api/admin/export\nDisallow: /internal/\nDisallow: /api/users/search/\n"
    }


# VULN (Easy): Exposed .env endpoint
@app.get("/.env")
def dotenv():
    return {
        "DATABASE_URL": "sqlite:///./data/lab.db",
        "JWT_SECRET": "supersecretkey123",
        "ADMIN_EMAIL": "admin@nexuscloud.io",
        "DEBUG": "true",
        "SMTP_HOST": "smtp.nexuscloud.internal",
        "SMTP_PORT": "587",
        "SMTP_USER": "noreply@nexuscloud.io",
        "SMTP_PASS": "mailpass2024!",
        "AWS_ACCESS_KEY": "AKIAIOSFODNN7EXAMPLE",
        "AWS_SECRET_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    }


# VULN (Easy): Open redirect via 'next' parameter — no validation
@app.get("/redirect")
def open_redirect(next: str = "/"):
    """Redirect after action (e.g., after login). The 'next' parameter is not validated."""
    # VULN: Attacker can set next=https://evil.com to redirect victims
    return RedirectResponse(url=next)


# VULN (Easy): Stack trace exposure — unhandled exceptions return full traceback
@app.get("/api/debug/error")
def trigger_error():
    """Test error handling (should be removed in production)."""
    # VULN: Intentional error to demonstrate stack trace exposure
    result = 1 / 0  # noqa: F841
    return {"status": "ok"}
