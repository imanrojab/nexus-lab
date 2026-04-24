from sqlmodel import SQLModel, Session, select
from app.db.database import engine
from app.models.user import User
from app.models.project import Project, Task, Comment
from app.models.file import UploadedFile
from app.models.feedback import Feedback, Notification, AuditLog
from app.models.organization import Organization, OrgMembership, OrgInvite
from app.models.social import Post, PostComment, PostLike, Follow
from app.models.internal import PasswordResetToken, CreditWallet, Coupon
from app.core.security import hash_password
import secrets


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _seed_if_empty()


def _seed_if_empty() -> None:
    with Session(engine) as s:
        count = s.exec(select(User)).first()
        if count:
            return
        _seed_users(s)
        _seed_orgs(s)
        _seed_projects(s)
        _seed_tasks(s)
        _seed_comments(s)
        _seed_feedback(s)
        _seed_notifications(s)
        _seed_social(s)
        _seed_wallets_and_coupons(s)
        s.commit()


# ── Users ──────────────────────────────────────────────────────────────────────

def _seed_users(s: Session) -> None:
    users = [
        # -- Org 1: Acme Corp --
        User(
            username="admin", email="admin@nexuscloud.io",
            password_hash=hash_password("admin123"),
            full_name="Sarah Chen", bio="Platform administrator. Building NexusCloud since 2022.",
            role="admin", department="Engineering", phone="+1-555-0100",
            api_key=secrets.token_hex(24), avatar_url="/avatars/admin.png",
            is_private=False, default_org_id=1,
            followers_count=4, following_count=2, posts_count=3,
        ),
        User(
            username="manager1", email="david.kim@nexuscloud.io",
            password_hash=hash_password("manager123"),
            full_name="David Kim", bio="Project manager overseeing enterprise deployments.",
            role="manager", department="Operations", phone="+1-555-0201",
            api_key=secrets.token_hex(24), avatar_url="/avatars/manager1.png",
            is_private=False, default_org_id=1,
            followers_count=2, following_count=3, posts_count=2,
        ),
        User(
            username="jsmith", email="john.smith@nexuscloud.io",
            password_hash=hash_password("password123"),
            full_name="John Smith", bio="Full-stack developer. React & Python enthusiast.",
            role="user", department="Engineering", phone="+1-555-0301",
            api_key=secrets.token_hex(24), avatar_url="/avatars/jsmith.png",
            is_private=False, default_org_id=1,
            followers_count=3, following_count=4, posts_count=4,
        ),
        # -- Org 2: DevStudio --
        User(
            username="emily_r", email="emily.ross@devstudio.io",
            password_hash=hash_password("emily2024"),
            full_name="Emily Ross", bio="UX designer focused on enterprise SaaS products.",
            role="user", department="Design", phone="+1-555-0302",
            api_key=secrets.token_hex(24), avatar_url="/avatars/emily.png",
            is_private=True, default_org_id=2,  # PRIVATE ACCOUNT
            followers_count=2, following_count=2, posts_count=3,
        ),
        User(
            username="alex_dev", email="alex.turner@devstudio.io",
            password_hash=hash_password("alexpass"),
            full_name="Alex Turner", bio="Backend engineer. Microservices & cloud infrastructure.",
            role="user", department="Engineering", phone="+1-555-0303",
            api_key=secrets.token_hex(24), avatar_url="/avatars/alex.png",
            is_private=False, default_org_id=2,
            followers_count=3, following_count=3, posts_count=2,
        ),
        # -- Org 3: solo freelancer --
        User(
            username="guest", email="guest@nexuscloud.io",
            password_hash=hash_password("guest123"),
            full_name="Guest User", bio="Trial account exploring NexusCloud.",
            role="guest", department="", phone="",
            api_key=secrets.token_hex(24), avatar_url="",
            is_private=False, default_org_id=3,
            followers_count=0, following_count=1, posts_count=0,
        ),
        # -- Org 2 member (DevStudio) --
        User(
            username="lisa_m", email="lisa.martinez@devstudio.io",
            password_hash=hash_password("lisa2024"),
            full_name="Lisa Martinez", bio="Frontend engineer specializing in React and TypeScript.",
            role="user", department="Engineering", phone="+1-555-0304",
            api_key=secrets.token_hex(24), avatar_url="/avatars/lisa.png",
            is_private=False, default_org_id=2,
            followers_count=2, following_count=3, posts_count=2,
        ),
        # -- Org 1 member (Acme Corp) --
        User(
            username="mike_ops", email="mike.wilson@nexuscloud.io",
            password_hash=hash_password("mike2024"),
            full_name="Mike Wilson", bio="DevOps engineer. Kubernetes, Terraform, and AWS.",
            role="user", department="Operations", phone="+1-555-0305",
            api_key=secrets.token_hex(24), avatar_url="/avatars/mike.png",
            is_private=False, default_org_id=1,
            followers_count=1, following_count=2, posts_count=1,
        ),
    ]
    for u in users:
        s.add(u)
    s.flush()


# ── Organizations ──────────────────────────────────────────────────────────────

def _seed_orgs(s: Session) -> None:
    orgs = [
        Organization(
            name="Acme Corp", slug="acme-corp",
            description="Enterprise SaaS company building next-generation cloud solutions.",
            logo_url="/logos/acme.png", industry="Technology", website="https://acmecorp.io",
            plan="enterprise", owner_id=1,
        ),
        Organization(
            name="DevStudio", slug="devstudio",
            description="Boutique design and development studio for startups.",
            logo_url="/logos/devstudio.png", industry="Agency", website="https://devstudio.io",
            plan="pro", owner_id=4,
        ),
        Organization(
            name="Freelance Hub", slug="freelance-hub",
            description="Personal workspace.",
            logo_url="", industry="", website="",
            plan="free", owner_id=6,
        ),
    ]
    for o in orgs:
        s.add(o)
    s.flush()

    memberships = [
        # Acme Corp (org 1): admin(1), manager1(2), jsmith(3), mike_ops(8)
        OrgMembership(org_id=1, user_id=1, role="owner"),
        OrgMembership(org_id=1, user_id=2, role="admin"),
        OrgMembership(org_id=1, user_id=3, role="member"),
        OrgMembership(org_id=1, user_id=8, role="member"),
        # DevStudio (org 2): emily_r(4), alex_dev(5), lisa_m(7)
        OrgMembership(org_id=2, user_id=4, role="owner"),
        OrgMembership(org_id=2, user_id=5, role="admin"),
        OrgMembership(org_id=2, user_id=7, role="member"),
        # Freelance Hub (org 3): guest(6)
        OrgMembership(org_id=3, user_id=6, role="owner"),
    ]
    for m in memberships:
        s.add(m)
    s.flush()


# ── Projects (org-scoped) ─────────────────────────────────────────────────────

def _seed_projects(s: Session) -> None:
    projects = [
        # Acme Corp projects (org_id=1)
        Project(name="NexusCloud Platform", description="Core SaaS platform development. Includes API gateway, microservice orchestration, and CI/CD pipeline integration.", org_id=1, owner_id=1, status="active", visibility="internal", budget=150000.0, deadline="2026-09-30", category="Engineering"),
        Project(name="Customer Data Migration", description="Migrating legacy customer data from Oracle to PostgreSQL. Includes data validation and compliance audit.", org_id=1, owner_id=1, status="active", visibility="private", budget=45000.0, deadline="2026-06-01", category="Data"),
        Project(name="Internal Security Audit", description="Quarterly security assessment of all internal tools and services. Penetration testing and vulnerability remediation.", org_id=1, owner_id=1, status="draft", visibility="private", budget=60000.0, deadline="2026-08-01", category="Security"),
        Project(name="API v3 Development", description="Next-generation REST API with GraphQL support. Rate limiting, OAuth2.0, and webhook infrastructure.", org_id=1, owner_id=3, status="active", visibility="internal", budget=95000.0, deadline="2026-10-01", category="Engineering"),
        # DevStudio projects (org_id=2)
        Project(name="Mobile App Redesign", description="Complete UX overhaul for iOS and Android applications. Focus on accessibility and performance optimization.", org_id=2, owner_id=4, status="active", visibility="private", budget=75000.0, deadline="2026-07-15", category="Design"),
        Project(name="Startup Landing Pages", description="Design and develop landing pages for 3 startup clients. A/B testing and analytics integration.", org_id=2, owner_id=5, status="active", visibility="internal", budget=25000.0, deadline="2026-06-15", category="Marketing"),
        Project(name="Design System v2", description="Complete redesign of component library with new brand guidelines and accessibility improvements.", org_id=2, owner_id=4, status="active", visibility="private", budget=40000.0, deadline="2026-08-30", category="Design"),
        # Freelance Hub (org_id=3) — guest has no projects by default
    ]
    for p in projects:
        s.add(p)
    s.flush()


def _seed_tasks(s: Session) -> None:
    tasks = [
        # Acme Corp tasks
        Task(project_id=1, title="Setup Kubernetes cluster", description="Configure k8s cluster on AWS EKS with auto-scaling policies.", assigned_to=3, created_by=1, status="done", priority="high", due_date="2026-03-15"),
        Task(project_id=1, title="Implement API rate limiting", description="Add Redis-based rate limiting to all public endpoints. Target: 1000 req/min per API key.", assigned_to=8, created_by=1, status="in_progress", priority="high", due_date="2026-04-30"),
        Task(project_id=1, title="Database connection pooling", description="Implement PgBouncer for connection pooling. Current max connections hitting limit during peak hours.", assigned_to=8, created_by=2, status="todo", priority="critical", due_date="2026-05-01"),
        Task(project_id=1, title="Setup monitoring dashboard", description="Grafana + Prometheus stack for real-time system monitoring.", assigned_to=3, created_by=1, status="in_progress", priority="medium", due_date="2026-05-15"),
        Task(project_id=2, title="Schema mapping document", description="Map Oracle schema to PostgreSQL. Document all type conversions and edge cases.", assigned_to=8, created_by=1, status="done", priority="critical", due_date="2026-02-15"),
        Task(project_id=2, title="Data validation scripts", description="Python scripts to validate data integrity post-migration.", assigned_to=3, created_by=1, status="in_progress", priority="high", due_date="2026-04-30"),
        Task(project_id=4, title="GraphQL schema design", description="Design GraphQL schema for all resources. Include pagination, filtering, and real-time subscriptions.", assigned_to=3, created_by=3, status="in_progress", priority="high", due_date="2026-06-15"),
        Task(project_id=4, title="OAuth2.0 integration", description="Implement OAuth2.0 with PKCE flow. Support Google, GitHub, and Microsoft providers.", assigned_to=8, created_by=3, status="todo", priority="high", due_date="2026-07-01"),
        Task(project_id=3, title="Vulnerability scan", description="Run automated vulnerability scan on all public-facing services using OWASP ZAP.", assigned_to=8, created_by=1, status="todo", priority="critical", due_date="2026-05-30"),
        # DevStudio tasks
        Task(project_id=5, title="User research interviews", description="Conduct 15 user interviews with enterprise customers.", assigned_to=4, created_by=4, status="done", priority="high", due_date="2026-03-01"),
        Task(project_id=5, title="Design system components", description="Create Figma component library with dark mode support and WCAG 2.1 AA compliance.", assigned_to=7, created_by=4, status="in_progress", priority="high", due_date="2026-05-30"),
        Task(project_id=5, title="Prototype navigation redesign", description="Interactive prototype for new sidebar navigation. A/B test with 200 users.", assigned_to=4, created_by=5, status="todo", priority="medium", due_date="2026-06-15"),
        Task(project_id=6, title="Landing page for ClientA", description="Design and develop responsive landing page with analytics.", assigned_to=7, created_by=5, status="in_progress", priority="high", due_date="2026-05-15"),
        Task(project_id=7, title="Component audit", description="Audit existing 120+ components for accessibility and performance.", assigned_to=7, created_by=4, status="todo", priority="medium", due_date="2026-06-01"),
    ]
    for t in tasks:
        s.add(t)
    s.flush()


def _seed_comments(s: Session) -> None:
    comments = [
        # Acme Corp comments
        Comment(task_id=1, user_id=3, content="Cluster is up. 3 nodes with t3.xlarge instances. Auto-scaling tested up to 10 nodes."),
        Comment(task_id=1, user_id=1, content="Looks great. Make sure we have proper RBAC policies before moving to production."),
        Comment(task_id=2, user_id=8, content="Using sliding window algorithm. Current implementation handles burst traffic well."),
        Comment(task_id=2, user_id=1, content="Can we add per-endpoint rate limits? Some endpoints like /search should have lower limits."),
        Comment(task_id=4, user_id=3, content="Grafana dashboards configured. Need access credentials from DevOps team."),
        Comment(task_id=5, user_id=8, content="Schema mapping complete. 847 tables, 23 require manual type conversion. Document uploaded."),
        Comment(task_id=6, user_id=3, content="Validation scripts catching 0.3% data inconsistencies. Mostly datetime format issues."),
        Comment(task_id=7, user_id=3, content="Base schema done. Added relay-style cursor pagination. Need feedback on subscription design."),
        # DevStudio comments
        Comment(task_id=10, user_id=4, content="Completed 12 out of 15 interviews. Key finding: 73% of users struggle with team permissions setup."),
        Comment(task_id=10, user_id=5, content="Great insights. Let's prioritize the permissions UI in the redesign."),
        Comment(task_id=11, user_id=7, content="Component library at 60% completion. Dark mode tokens are tricky with existing color system."),
        Comment(task_id=11, user_id=4, content="Try using CSS custom properties for the color tokens. I'll share a reference doc."),
    ]
    for c in comments:
        s.add(c)
    s.flush()


def _seed_feedback(s: Session) -> None:
    feedbacks = [
        Feedback(user_id=3, subject="Dashboard loading time", message="Dashboard takes 4-5 seconds to load on first visit. Could we implement lazy loading for the analytics widgets?", category="bug", status="read"),
        Feedback(user_id=4, subject="Dark mode support", message="Would love to see dark mode across the platform. The current light-only theme is hard on the eyes during late sessions.", category="feature", status="unread"),
        Feedback(user_id=5, subject="API documentation", message="The API docs at /api/docs are missing examples for bulk operations. Also, the webhook section is outdated.", category="bug", status="resolved"),
        Feedback(user_id=3, subject="Export functionality", message="CSV export for project reports would be incredibly useful. Currently we have to manually copy data.", category="feature", status="unread"),
        Feedback(user_id=7, subject="Mobile responsiveness", message="The project detail page is unusable on mobile. Columns overflow and buttons are too small to tap.", category="bug", status="unread"),
    ]
    for f in feedbacks:
        s.add(f)
    s.flush()


def _seed_notifications(s: Session) -> None:
    notifs = [
        Notification(user_id=3, title="Task assigned", message="You've been assigned to 'Database connection pooling'", link="/projects/1", is_read=False),
        Notification(user_id=4, title="New follow request", message="John Smith wants to follow you", link="/profile/3", is_read=False),
        Notification(user_id=5, title="Project deadline updated", message="API v3 Development deadline moved to Oct 1, 2026", link="/projects/4", is_read=True),
        Notification(user_id=3, title="New team member", message="Mike Wilson joined Acme Corp workspace", link="/team", is_read=True),
        Notification(user_id=1, title="System alert", message="Database CPU usage exceeded 85% threshold at 14:32 UTC", link="/admin", is_read=False),
        Notification(user_id=7, title="Comment on your task", message="Emily Ross commented on 'Design system components'", link="/projects/5", is_read=False),
        Notification(user_id=8, title="Task assigned", message="You've been assigned to 'Implement API rate limiting'", link="/projects/1", is_read=False),
    ]
    for n in notifs:
        s.add(n)
    s.flush()


# ── Social ─────────────────────────────────────────────────────────────────────

def _seed_social(s: Session) -> None:
    # Posts
    posts = [
        # Public posts
        Post(author_id=1, content="Excited to announce NexusCloud v2.4 is live! Major performance improvements and new team collaboration features. Check out the changelog.", visibility="public", likes_count=12, comments_count=3),
        Post(author_id=3, content="Just finished setting up our Kubernetes cluster with auto-scaling. 3 nodes to 10 seamlessly. The power of EKS never ceases to amaze.", visibility="public", likes_count=8, comments_count=2),
        Post(author_id=5, content="GraphQL vs REST debate in 2026: Why not both? Building our API v3 with a unified gateway that serves both. Best of both worlds.", visibility="public", likes_count=15, comments_count=4),
        Post(author_id=2, content="Team retrospective done. Key takeaway: we need better async communication tooling. Any recommendations?", visibility="public", likes_count=5, comments_count=2),
        Post(author_id=3, content="Pro tip: Always validate your migration scripts on a staging environment first. Saved us from a data integrity disaster today.", visibility="public", likes_count=20, comments_count=5),
        # Followers-only posts
        Post(author_id=1, content="Working on something big for Q3. Can't share details yet but it's going to change how teams collaborate on NexusCloud. Stay tuned.", visibility="followers", likes_count=7, comments_count=1),
        Post(author_id=5, content="Just deployed a microservice that processes 50K events/second on a single node. Rust + Tokio is insane for this workload.", visibility="followers", likes_count=11, comments_count=3),
        # Private posts (emily_r is a private account)
        Post(author_id=4, content="New design system exploration. Going with a minimal approach — less chrome, more content. The data says users just want to get things done.", visibility="private", likes_count=4, comments_count=1),
        Post(author_id=4, content="Client feedback session went great today. They loved the dark mode implementation. Sometimes the small things make the biggest difference.", visibility="followers", likes_count=6, comments_count=2),
        Post(author_id=4, content="Weekend project: built a Figma plugin that auto-generates color palettes from accessibility constraints. Might open source it.", visibility="public", likes_count=25, comments_count=6),
        # More public posts
        Post(author_id=7, content="First month at DevStudio! Amazing team, exciting projects. Already shipped a landing page that's converting at 12%. Let's go!", visibility="public", likes_count=9, comments_count=2),
        Post(author_id=8, content="Terraform + Ansible = infrastructure as code heaven. Just automated our entire staging environment setup. 45 minutes → 3 minutes.", visibility="public", likes_count=14, comments_count=3),
        Post(author_id=3, content="Hot take: TypeScript is the best thing that happened to JavaScript. Fight me.", visibility="public", likes_count=30, comments_count=8),
        Post(author_id=1, content="Hiring! We're looking for a senior backend engineer to join Acme Corp. Must love distributed systems and hate single points of failure. DM me.", visibility="public", likes_count=18, comments_count=4),
        Post(author_id=7, content="Learned more about React Server Components this week. The mental model shift is real but the performance gains are worth it.", visibility="followers", likes_count=5, comments_count=1),
        Post(author_id=2, content="Just completed our Q1 OKR review. 87% completion rate across all teams. Proud of what we've built together.", visibility="followers", likes_count=8, comments_count=2),
    ]
    for p in posts:
        s.add(p)
    s.flush()

    # Post comments
    post_comments = [
        PostComment(post_id=1, user_id=3, content="The new dashboard loads so much faster. Great work team!"),
        PostComment(post_id=1, user_id=5, content="Can't wait to try the new API features."),
        PostComment(post_id=1, user_id=2, content="Congrats to everyone who contributed!"),
        PostComment(post_id=2, user_id=1, content="Nice work John! Make sure to document the scaling policies for the team."),
        PostComment(post_id=2, user_id=8, content="What monitoring did you set up for the auto-scaling events?"),
        PostComment(post_id=3, user_id=3, content="Totally agree. We're doing the same with our gateway approach."),
        PostComment(post_id=3, user_id=1, content="Smart approach. Would love to see a blog post about this."),
        PostComment(post_id=5, user_id=1, content="This is so true. We almost had a major incident last quarter."),
        PostComment(post_id=5, user_id=8, content="Always test twice, deploy once!"),
        PostComment(post_id=10, user_id=5, content="Love the accessibility-first approach. We need more tools like this."),
        PostComment(post_id=10, user_id=7, content="Please open source it! I'd love to contribute."),
        PostComment(post_id=13, user_id=5, content="100% agree. The type safety alone makes it worth it."),
        PostComment(post_id=13, user_id=8, content="Counterpoint: sometimes plain JS is faster for prototyping."),
        PostComment(post_id=13, user_id=1, content="We switched our entire codebase to TS last year. Zero regrets."),
    ]
    for pc in post_comments:
        s.add(pc)
    s.flush()

    # Likes
    post_likes = [
        PostLike(post_id=1, user_id=3), PostLike(post_id=1, user_id=5), PostLike(post_id=1, user_id=2),
        PostLike(post_id=2, user_id=1), PostLike(post_id=2, user_id=8),
        PostLike(post_id=3, user_id=3), PostLike(post_id=3, user_id=1), PostLike(post_id=3, user_id=7),
        PostLike(post_id=5, user_id=1), PostLike(post_id=5, user_id=5), PostLike(post_id=5, user_id=8),
        PostLike(post_id=10, user_id=5), PostLike(post_id=10, user_id=7), PostLike(post_id=10, user_id=3),
        PostLike(post_id=13, user_id=5), PostLike(post_id=13, user_id=8), PostLike(post_id=13, user_id=1),
        PostLike(post_id=14, user_id=3), PostLike(post_id=14, user_id=5),
    ]
    for pl in post_likes:
        s.add(pl)
    s.flush()

    # Follows
    follows = [
        # Cross-org follows (public social)
        Follow(follower_id=3, following_id=1, status="accepted"),  # jsmith follows admin
        Follow(follower_id=3, following_id=5, status="accepted"),  # jsmith follows alex
        Follow(follower_id=3, following_id=7, status="accepted"),  # jsmith follows lisa
        Follow(follower_id=3, following_id=4, status="pending"),   # jsmith wants to follow emily (PRIVATE!)
        Follow(follower_id=1, following_id=3, status="accepted"),  # admin follows jsmith
        Follow(follower_id=1, following_id=5, status="accepted"),  # admin follows alex
        Follow(follower_id=5, following_id=1, status="accepted"),  # alex follows admin
        Follow(follower_id=5, following_id=3, status="accepted"),  # alex follows jsmith
        Follow(follower_id=5, following_id=4, status="accepted"),  # alex follows emily (ACCEPTED)
        Follow(follower_id=2, following_id=1, status="accepted"),  # manager follows admin
        Follow(follower_id=2, following_id=3, status="accepted"),  # manager follows jsmith
        Follow(follower_id=2, following_id=5, status="accepted"),  # manager follows alex
        Follow(follower_id=7, following_id=4, status="accepted"),  # lisa follows emily (ACCEPTED — same org)
        Follow(follower_id=7, following_id=5, status="accepted"),  # lisa follows alex
        Follow(follower_id=7, following_id=3, status="accepted"),  # lisa follows jsmith
        Follow(follower_id=8, following_id=1, status="accepted"),  # mike follows admin
        Follow(follower_id=8, following_id=3, status="accepted"),  # mike follows jsmith
        Follow(follower_id=6, following_id=1, status="accepted"),  # guest follows admin
        Follow(follower_id=4, following_id=5, status="accepted"),  # emily follows alex
        Follow(follower_id=4, following_id=7, status="accepted"),  # emily follows lisa
    ]
    for f in follows:
        s.add(f)
    s.flush()


def _seed_wallets_and_coupons(s: Session) -> None:
    # Credit wallets for all users
    for uid in range(1, 9):
        s.add(CreditWallet(user_id=uid, balance=100.0))

    # Coupons for race condition testing
    coupons = [
        Coupon(code="WELCOME25", discount=25.0, max_uses=1, used_count=0),
        Coupon(code="PREMIUM50", discount=50.0, max_uses=1, used_count=0),
        Coupon(code="UNLIMITED", discount=10.0, max_uses=999, used_count=0),
        Coupon(code="EXPIRED01", discount=100.0, max_uses=1, used_count=1, is_active=True),
    ]
    for c in coupons:
        s.add(c)
    s.flush()
