"""
Project & Task routes — org-scoped.
Vulnerabilities:
- Easy: IDOR on tasks — view/edit any task without project membership check
- Easy: IDOR on project details — view private projects by ID (cross-org)
- Medium: Stored XSS via task description and comment content
- Medium: Broken access control — guests can create tasks
- Hard: IDOR on project budget — modify financial data without owner check
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, func
from typing import Optional

from app.db.database import get_session
from app.models.project import Project, Task, Comment
from app.models.user import User
from app.models.organization import OrgMembership
from app.core.security import get_current_user_id

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectRequest(BaseModel):
    name: str
    description: str = ""
    visibility: str = "private"
    budget: float = 0.0
    deadline: str = ""
    category: str = ""
    org_id: int = 0


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    visibility: Optional[str] = None
    budget: Optional[float] = None
    deadline: Optional[str] = None


class CreateTaskRequest(BaseModel):
    title: str
    description: str = ""
    assigned_to: int = 0
    priority: str = "medium"
    due_date: str = ""


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[str] = None


class CreateCommentRequest(BaseModel):
    content: str


def _get_user_org_ids(user_id: int, session: Session) -> list[int]:
    return list(session.exec(
        select(OrgMembership.org_id).where(OrgMembership.user_id == user_id)
    ).all())


# ── Projects ────────────────────────────────────────────────────────────────

@router.get("")
def list_projects(
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
    org_id: int = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
):
    my_org_ids = _get_user_org_ids(current_user, session)

    # Scoped: only show projects from orgs user belongs to
    if org_id and org_id in my_org_ids:
        base_filter = Project.org_id == org_id
    else:
        base_filter = Project.org_id.in_(my_org_ids)

    offset = (page - 1) * limit
    total: int = session.exec(select(func.count(Project.id)).where(base_filter)).one()
    projects = session.exec(
        select(Project).where(base_filter).order_by(Project.created_at.desc()).offset(offset).limit(limit)
    ).all()

    items = []
    for p in projects:
        owner = session.get(User, p.owner_id)
        task_count: int = session.exec(
            select(func.count(Task.id)).where(Task.project_id == p.id)
        ).one()
        items.append({
            "id": p.id, "name": p.name, "description": p.description[:200],
            "status": p.status, "visibility": p.visibility, "category": p.category,
            "org_id": p.org_id,
            "owner": {"id": owner.id, "full_name": owner.full_name} if owner else None,
            "task_count": task_count, "deadline": p.deadline,
            "created_at": str(p.created_at),
        })

    return {"items": items, "total": total, "page": page, "limit": limit}


# VULN (Easy): IDOR — any user can view any project details (cross-org)
@router.get("/{project_id}")
def get_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    owner = session.get(User, project.owner_id)
    tasks = session.exec(select(Task).where(Task.project_id == project_id)).all()

    return {
        "id": project.id, "name": project.name, "description": project.description,
        "status": project.status, "visibility": project.visibility,
        "budget": project.budget, "deadline": project.deadline,
        "category": project.category, "org_id": project.org_id,
        "owner": {"id": owner.id, "full_name": owner.full_name, "email": owner.email} if owner else None,
        "tasks": [
            {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority,
             "assigned_to": t.assigned_to, "due_date": t.due_date}
            for t in tasks
        ],
        "created_at": str(project.created_at),
    }


@router.post("")
def create_project(
    body: CreateProjectRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    # Use user's default org if not specified
    org_id = body.org_id
    if not org_id:
        user = session.get(User, current_user)
        org_id = user.default_org_id if user else 0

    project = Project(
        name=body.name, description=body.description, owner_id=current_user,
        org_id=org_id, visibility=body.visibility, budget=body.budget,
        deadline=body.deadline, category=body.category,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return {"id": project.id, "name": project.name, "status": project.status}


# VULN (Medium): IDOR — any user can update any project (cross-org)
@router.patch("/{project_id}")
def update_project(
    project_id: int,
    body: UpdateProjectRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    session.add(project)
    session.commit()
    session.refresh(project)
    return {"id": project.id, "name": project.name, "status": project.status, "budget": project.budget}


@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    session.delete(project)
    session.commit()
    return {"ok": True}


# ── Tasks ───────────────────────────────────────────────────────────────────

@router.post("/{project_id}/tasks")
def create_task(
    project_id: int,
    body: CreateTaskRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    task = Task(
        project_id=project_id, title=body.title, description=body.description,
        assigned_to=body.assigned_to, created_by=current_user,
        priority=body.priority, due_date=body.due_date,
    )
    session.add(task)
    session.commit()
    session.refresh(task)
    return {"id": task.id, "title": task.title, "status": task.status}


# VULN (Easy): IDOR — view any task without membership check
@router.get("/{project_id}/tasks/{task_id}")
def get_task(
    project_id: int,
    task_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    creator = session.get(User, task.created_by)
    assignee = session.get(User, task.assigned_to)
    comments = session.exec(
        select(Comment).where(Comment.task_id == task_id).order_by(Comment.created_at)
    ).all()

    comment_list = []
    for c in comments:
        author = session.get(User, c.user_id)
        comment_list.append({
            "id": c.id, "content": c.content,
            "author": {"id": author.id, "full_name": author.full_name, "avatar_url": author.avatar_url} if author else None,
            "created_at": str(c.created_at),
        })

    return {
        "id": task.id, "project_id": task.project_id,
        "title": task.title, "description": task.description,
        "status": task.status, "priority": task.priority,
        "due_date": task.due_date,
        "creator": {"id": creator.id, "full_name": creator.full_name} if creator else None,
        "assignee": {"id": assignee.id, "full_name": assignee.full_name} if assignee else None,
        "comments": comment_list,
        "created_at": str(task.created_at),
    }


# VULN (Easy): IDOR — update any task without ownership check
@router.patch("/{project_id}/tasks/{task_id}")
def update_task(
    project_id: int,
    task_id: int,
    body: UpdateTaskRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)

    session.add(task)
    session.commit()
    session.refresh(task)
    return {"id": task.id, "title": task.title, "status": task.status}


@router.delete("/{project_id}/tasks/{task_id}")
def delete_task(
    project_id: int,
    task_id: int,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    session.delete(task)
    session.commit()
    return {"ok": True}


# ── Comments ────────────────────────────────────────────────────────────────

# VULN (Medium): Stored XSS — comment content not sanitized
@router.post("/{project_id}/tasks/{task_id}/comments")
def add_comment(
    project_id: int,
    task_id: int,
    body: CreateCommentRequest,
    session: Session = Depends(get_session),
    current_user: int = Depends(get_current_user_id),
):
    task = session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    comment = Comment(task_id=task_id, user_id=current_user, content=body.content)
    session.add(comment)
    session.commit()
    session.refresh(comment)

    author = session.get(User, current_user)
    return {
        "id": comment.id, "content": comment.content,
        "author": {"id": author.id, "full_name": author.full_name} if author else None,
        "created_at": str(comment.created_at),
    }
