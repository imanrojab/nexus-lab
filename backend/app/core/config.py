"""
Application configuration.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"

DATABASE_URL = f"sqlite:///{DATA_DIR / 'lab.db'}"

# VULN: JWT secret is weak and hardcoded (A02 - Cryptographic Failures)
JWT_SECRET = "supersecretkey123"
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 60 * 24  # 24 hours

CORS_ORIGINS = ["*"]

APP_NAME = "NexusCloud"
APP_VERSION = "2.4.1"
