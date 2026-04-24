<div align="center">

# NexusCloud Security Lab

### A Realistic Vulnerable Web Application for Penetration Testing Practice

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Vulnerabilities](https://img.shields.io/badge/Vulnerabilities-100-red)](http://localhost:9001/blog/vuln-list)
[![OWASP](https://img.shields.io/badge/OWASP-Top_10_2021-orange)](https://owasp.org/Top10/)

---

**NexusCloud** looks and feels like a professional SaaS platform — a cloud workspace with CRM, social media, project management, and internal tools. But hidden beneath the fully functional UI are **100 intentional security vulnerabilities** covering every OWASP Top 10 category.

Your mission: **find them all.**

[Getting Started](#getting-started) · [Vulnerability Map](#vulnerability-coverage) · [Default Accounts](#default-accounts) · [Rules of Engagement](#rules-of-engagement)

</div>

---

> [!CAUTION]
> **This application is intentionally vulnerable.** Do NOT deploy it on any public-facing server, cloud instance, or production environment. Use it **only** in isolated local/LAN environments for authorized educational and testing purposes.

---

## What is NexusCloud?

NexusCloud simulates a real enterprise SaaS platform that a pentester might encounter during an engagement. Unlike toy vulnerable apps, NexusCloud has a **polished UI**, **realistic data flows**, and **multi-tenant architecture** — making vulnerability discovery feel like a real-world assessment.

### Platform Features

| Module | Description |
|:---|:---|
| **Multi-Tenant Workspaces** | Organizations with isolated projects, files, and team members |
| **Social Media** | Instagram-style posts with public/private/followers visibility, follow system with approval flow, feed, likes, comments |
| **Project Management** | Projects, tasks, comments, file uploads with role-based access |
| **Admin Panel** | User management, audit logs, data export, webhook tester, debug tools |
| **Internal Tools** | Calculator, template renderer, URL preview, config manager, credit wallet system |
| **Auth System** | Login, registration, password reset, 2FA, OAuth flow |

> Every feature is fully functional. The vulnerabilities are woven into the business logic — not bolted on as obvious traps.

---

## Vulnerability Coverage

NexusCloud contains **100 vulnerabilities** across all OWASP Top 10 (2021) categories:

```
Broken Access Control  ████████████████████████████████████████████  22
Injection              ██████████████████████████████████████        19
Auth Failures          ██████████████████████                        11
Insecure Design        ██████████████████████                        11
Security Misconfig     █████████████████                              9
Cryptographic Failures ██████████████                                 7
SSRF                   ██████████████                                 7
Logging Failures       ████████████                                   6
Data Integrity         ██████████                                     5
Vulnerable Components  ██████                                         3
                                                           Total:   100
```

<details>
<summary><b>Detailed Breakdown by Category</b></summary>

| # | OWASP Category | Count | Example Techniques |
|:---:|:---|:---:|:---|
| A01 | Broken Access Control | 22 | Cross-org IDOR, private post bypass, privilege escalation, open redirect, path traversal, missing function-level access control |
| A02 | Cryptographic Failures | 7 | Weak JWT secret, predictable reset tokens, PII in JWT payload, MD5 token generation, cleartext sensitive data |
| A03 | Injection | 19 | SQL injection (blind, second-order, ORM filter), stored/reflected XSS, SSTI, eval() RCE, YAML deserialization, Pickle deserialization, CSV formula injection, CRLF injection, log forging |
| A04 | Insecure Design | 11 | Race conditions (TOCTOU, double-spend), ReDoS, negative price manipulation, unbounded queries, missing rate limits |
| A05 | Security Misconfiguration | 9 | Exposed `.env`, open Swagger docs, missing security headers, verbose error messages, debug endpoints, backup file exposure |
| A06 | Vulnerable Components | 3 | ReDoS regex patterns, server-side object injection via deep merge |
| A07 | Authentication Failures | 11 | 2FA bypass (4-digit, no lockout), OAuth redirect URI bypass (startswith check), timing side-channel, password reset token reuse, Host header poisoning |
| A08 | Data Integrity Failures | 5 | Unsigned webhooks, client-side only validation, HTTP method override, unverified OAuth state |
| A09 | Logging & Monitoring Failures | 6 | Log forging/injection, missing audit trail, stack trace exposure, path disclosure in errors |
| A10 | SSRF | 7 | Redirect chain following, `file://` scheme access, IP obfuscation bypass (decimal/hex/octal notation), DNS rebinding potential |

</details>

### Difficulty Distribution

| Level | Count | Description |
|:---|:---:|:---|
| Easy | 25 | Discoverable with basic tools (browser DevTools, curl) |
| Medium | 43 | Requires understanding of attack techniques and chaining |
| Hard | 32 | Needs advanced exploitation, race conditions, or multi-step chains |

---

## Tech Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Backend** | Python 3.13, FastAPI, SQLModel | REST API, ORM, async support |
| **Database** | SQLite | Zero-config, file-based, auto-seeded |
| **Frontend** | React 19, TypeScript 5.7, Vite | SPA with modern component architecture |
| **Styling** | Tailwind CSS 4 | Utility-first responsive design |
| **Auth** | python-jose (JWT), passlib (bcrypt) | Token-based authentication |
| **Templates** | Jinja2 | Used in internal tools (SSTI target) |
| **Serialization** | PyYAML | Used in config management (deserialization target) |

---

## Getting Started

### Prerequisites

| Requirement | Minimum | Tested On |
|:---|:---|:---|
| Python | 3.11+ | 3.13 |
| Node.js | 18+ | 22 |
| Git | Any | Latest |

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/imanrojab/nexus-lab.git
cd nexus-lab
```

**2. Start the backend**

```bash
cd backend

# Create & activate virtual environment
python3 -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate           # Windows

# Install dependencies
pip install -r requirements.txt
pip install 'bcrypt==4.0.1'       # Required for passlib on Python 3.13

# Launch the API server
uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
```

> The SQLite database is **automatically created and seeded** with sample data on first startup. No manual migration needed.

**3. Start the frontend**

```bash
cd frontend

npm install
npm run dev -- --host 0.0.0.0 --port 9001
```

**4. Open the lab**

| Service | URL |
|:---|:---|
| Application | http://localhost:9001 |
| API Documentation (Swagger) | http://localhost:9000/docs |
| Vulnerability Reference | http://localhost:9001/blog/vuln-list |

---

## Default Accounts

All accounts are pre-seeded and ready to use:

| Username | Password | Role | Organization | Notes |
|:---|:---|:---:|:---|:---|
| `admin` | `admin123` | Admin | Acme Corp (Enterprise) | Full platform access |
| `manager1` | `manager123` | Manager | Acme Corp | Team management access |
| `jsmith` | `password123` | User | Acme Corp | Standard user |
| `mike_ops` | `mike2024` | User | Acme Corp | Operations team |
| `emily_r` | `emily2024` | User | DevStudio | **Private account** |
| `alex_dev` | `alexpass` | User | DevStudio | Developer |
| `lisa_m` | `lisa2024` | User | DevStudio | Designer |
| `guest` | `guest123` | Guest | Freelance Hub | Limited permissions |

> **Tip:** Testing access control vulnerabilities requires switching between accounts from different organizations and privilege levels.

---

## Architecture

```
nexus-lab/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # API endpoints
│   │   │   ├── auth.py          # Login, register, password reset, 2FA, OAuth
│   │   │   ├── users.py         # User CRUD, profile management
│   │   │   ├── projects.py      # Projects, tasks, comments, files
│   │   │   ├── social.py        # Posts, feed, follow system, likes
│   │   │   ├── admin.py         # Admin panel, audit logs, exports
│   │   │   └── internal.py      # Internal tools (calculator, templates, URL preview...)
│   │   ├── core/                # Config, security helpers
│   │   ├── db/                  # Database engine, seed data
│   │   ├── models/              # SQLModel ORM models
│   │   └── main.py              # FastAPI app + middleware
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Layout (Navbar, Sidebar)
│   │   ├── pages/               # All page components
│   │   ├── lib/                 # API client utilities
│   │   └── App.tsx              # Router configuration
│   └── package.json
├── .gitignore
└── README.md
```

<details>
<summary><b>Key API Endpoints</b></summary>

| Method | Endpoint | Description |
|:---:|:---|:---|
| POST | `/api/auth/login` | Login with username or email |
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/setup-2fa` | Enable two-factor auth |
| GET | `/api/auth/oauth/authorize` | OAuth authorization flow |
| GET | `/api/users` | List users |
| PATCH | `/api/users/{id}` | Update user profile |
| GET | `/api/projects` | List projects (org-scoped) |
| GET | `/api/feed` | Social media feed |
| POST | `/api/posts` | Create a post |
| GET | `/api/admin/users` | Admin user management |
| GET | `/api/admin/export` | Data export |
| POST | `/api/internal/calculate` | Calculator tool |
| POST | `/api/internal/render-template` | Template renderer |
| POST | `/api/internal/url-preview` | URL preview / fetcher |
| POST | `/api/internal/webhook-receive` | Webhook receiver |
| GET | `/api/internal/wallet/balance` | Credit wallet |
| GET | `/.env` | Exposed environment file |
| GET | `/docs` | Swagger UI (OpenAPI) |
| GET | `/redirect?next=` | URL redirect handler |

</details>

---

## Resetting the Lab

To wipe all data and start fresh with the original seed:

```bash
# Stop the backend, then:
rm backend/data/lab.db

# Restart — database is recreated automatically
uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload
```

---

## LAN Access

Access the lab from other devices on your local network (e.g., test from a separate machine or mobile device):

```bash
# Both servers already bind to 0.0.0.0
# Find your local IP:
ifconfig | grep "inet " | grep -v 127.0.0.1    # macOS/Linux
ipconfig                                         # Windows

# Access from other devices:
# http://<your-ip>:9001 (frontend)
# http://<your-ip>:9000 (API)
```

> If the frontend can't reach the backend from a LAN device, update the proxy target in `frontend/vite.config.ts` to your host machine's LAN IP.

---

## Recommended Tools

These tools are useful for exploring the vulnerabilities:

| Tool | Use Case |
|:---|:---|
| **Browser DevTools** | Inspect requests, modify localStorage, edit DOM |
| **Burp Suite / OWASP ZAP** | Intercept & modify HTTP traffic, scan for vulns |
| **curl / httpie** | Manual API testing, header manipulation |
| **sqlmap** | Automated SQL injection detection & exploitation |
| **Postman** | API collection building, auth token management |
| **jwt.io** | Decode and tamper with JWT tokens |
| **Hashcat / John** | Crack weak hashes found in the app |
| **ffuf / dirsearch** | Directory and endpoint brute-forcing |
| **Nuclei** | Template-based vulnerability scanning |

---

## Rules of Engagement

> **Read this before you start.** These rules ensure safe and productive use of the lab.

### Allowed

- Run NexusCloud on `localhost` or within an isolated private network
- Use any offensive security tools and techniques against the running instance
- Modify source code to understand vulnerability mechanics
- Share your findings, writeups, and walkthroughs publicly
- Use this lab for CTF events, workshops, and training sessions
- Fork and modify for your own educational purposes

### Not Allowed

- Deploy NexusCloud on any internet-facing server or cloud instance
- Use discovered techniques against systems you don't own or have permission to test
- Claim the vulnerabilities as real zero-days or CVEs
- Misrepresent this lab as a production-ready application
- Remove attribution or license notices

### Best Practices

- **Isolate your environment** — use a dedicated VM or Docker network if possible
- **Document your findings** — write notes for each vulnerability you discover
- **Try before you peek** — attempt to find vulns independently before checking the reference list
- **Understand the fix** — for each vulnerability, think about how you would remediate it in a real application
- **Practice responsible methodology** — follow the same workflow you'd use in a real engagement (recon → discovery → exploitation → reporting)

---

## Terms of Use

By cloning, downloading, or using this software, you agree to the following:

1. **Educational Purpose Only** — This software is designed exclusively for authorized security testing, education, and research. You acknowledge that the application contains intentional vulnerabilities and must never be used in a production environment.

2. **No Liability** — The author(s) provide this software "as is" without warranty. The author(s) are not responsible for any damage, data loss, legal consequences, or misuse arising from the use of this software.

3. **Authorized Use** — You will only run this application in environments you own or have explicit written permission to test. You will not use knowledge gained from this lab to attack systems without proper authorization.

4. **Compliance** — You are responsible for ensuring your use of this software complies with all applicable local, national, and international laws and regulations regarding computer security testing.

5. **No Redistribution as Production Software** — You may fork, modify, and share this project for educational purposes, but you must not redistribute it as production-ready software or remove the vulnerability warnings and disclaimers.

6. **Acknowledgment of Risk** — You understand that running intentionally vulnerable software carries inherent risks and you accept full responsibility for securing your testing environment.

---

## Contributing

Contributions are welcome! You can help by:

- Adding new vulnerability scenarios
- Improving the UI/UX of the platform
- Writing vulnerability writeups and walkthroughs
- Fixing bugs in the platform logic (not the intentional vulnerabilities!)
- Improving documentation

Please open an issue first to discuss significant changes.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built for learning. Hack responsibly.**

Made with passion for the security community.

</div>
