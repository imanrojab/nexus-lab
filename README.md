# NexusCloud Security Lab

A deliberately vulnerable web application designed for penetration testing practice. NexusCloud looks and feels like a professional SaaS platform (CRM + social media) — but contains **100 intentional security vulnerabilities** covering all OWASP Top 10 categories.

> **WARNING:** This application is intentionally vulnerable. Do NOT deploy it on any public-facing server or production environment. Use it only in isolated local/LAN environments for educational purposes.

## Features

NexusCloud simulates a real enterprise platform with:

- **Multi-tenant workspaces** — Organizations with isolated projects, files, and team members
- **Social media features** — Instagram-like posts with public/private/followers visibility, follow system with approval for private accounts, feed, likes, comments
- **Project management** — Projects, tasks, comments, file uploads
- **Admin panel** — User management, audit logs, data export, webhook tester, debug info
- **Internal tools** — Calculator, template renderer, URL preview, config management, credit wallet system

All features work realistically — the vulnerabilities are hidden beneath a fully functional UI.

## Vulnerability Coverage

| OWASP Category | Count | Examples |
|---|---|---|
| A01: Broken Access Control | 22 | Cross-org IDOR, private post bypass, open redirect |
| A02: Cryptographic Failures | 7 | Weak JWT secret, predictable reset tokens, PII in JWT |
| A03: Injection | 19 | SQLi, XSS, SSTI, eval() RCE, YAML/Pickle deserialization |
| A04: Insecure Design | 11 | Race conditions, ReDoS, negative price manipulation |
| A05: Security Misconfiguration | 9 | Exposed .env, open Swagger docs, missing headers |
| A06: Vulnerable Components | 3 | ReDoS regex, server-side object injection |
| A07: Auth Failures | 11 | 2FA bypass, OAuth redirect URI bypass, timing side-channel |
| A08: Data Integrity Failures | 5 | Unsigned webhooks, client-side only validation |
| A09: Logging Failures | 6 | Log forging, missing audit trail, path disclosure |
| A10: SSRF | 7 | Redirect chain, file:// scheme, IP obfuscation bypass |
| **Total** | **100** | |

**Difficulty distribution:** 25 Easy, 43 Medium, 21 Hard (11 not categorized by difficulty in this count)

## Tech Stack

| Component | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, SQLModel, SQLite |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Auth | JWT (python-jose), bcrypt (passlib) |

## Quick Start

### Prerequisites

- Python 3.11+ (tested on 3.13)
- Node.js 18+ (tested on 22)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/imanrojab/nexus-lab.git
cd nexus-lab
```

### 2. Start the backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install 'bcrypt==4.0.1'   # Required for passlib compatibility on Python 3.13

# Start the server (port 9000)
uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
```

The database is automatically created and seeded with sample data on first run.

### 3. Start the frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (port 9001)
npm run dev -- --host 0.0.0.0 --port 9001
```

### 4. Access the lab

- **Application:** http://localhost:9001
- **API Docs (Swagger):** http://localhost:9000/docs
- **Vulnerability Reference:** http://localhost:9001/blog/vuln-list

## Default Accounts

| Username | Password | Role | Organization |
|---|---|---|---|
| admin | admin123 | admin | Acme Corp (enterprise) |
| manager1 | manager123 | manager | Acme Corp |
| jsmith | password123 | user | Acme Corp |
| mike_ops | mike2024 | user | Acme Corp |
| emily_r | emily2024 | user | DevStudio (private account) |
| alex_dev | alexpass | user | DevStudio |
| lisa_m | lisa2024 | user | DevStudio |
| guest | guest123 | guest | Freelance Hub |

## Architecture

```
nexus-lab/
├── backend/
│   ├── app/
│   │   ├── api/routes/       # API endpoints (auth, users, projects, social, admin, internal)
│   │   ├── core/             # Config, security utilities
│   │   ├── db/               # Database engine, seed data
│   │   ├── models/           # SQLModel ORM models
│   │   └── main.py           # FastAPI app entry point
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # Layout (Navbar, Sidebar)
│   │   ├── pages/            # All page components
│   │   ├── lib/              # API client utilities
│   │   └── App.tsx           # Router configuration
│   └── package.json
└── README.md
```

## Key API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/login` | Login (username or email) |
| `POST /api/auth/register` | Register new account |
| `GET /api/projects` | List projects (org-scoped) |
| `GET /api/feed` | Social feed |
| `POST /api/posts` | Create a post |
| `GET /api/internal/*` | Internal developer tools |
| `GET /api/admin/*` | Admin panel endpoints |
| `GET /.env` | Exposed environment file |
| `GET /docs` | Swagger API documentation |

## Resetting the Lab

To reset all data back to the initial seed state:

```bash
# Delete the database (auto-recreated on restart)
rm backend/data/lab.db

# Restart the backend
uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
```

## LAN Access

To access the lab from other devices on your network:

```bash
# Both servers already bind to 0.0.0.0
# Find your local IP:
ifconfig | grep "inet " | grep -v 127.0.0.1

# Access from other devices:
# http://<your-ip>:9001
```

Update the frontend API proxy in `frontend/vite.config.ts` if needed to point to your backend's LAN IP.

## Disclaimer

This project is for **authorized security testing and educational purposes only**. All vulnerabilities are intentionally embedded. The creator is not responsible for any misuse of this software. Always practice responsible disclosure and only test systems you have explicit permission to test.

## License

MIT
