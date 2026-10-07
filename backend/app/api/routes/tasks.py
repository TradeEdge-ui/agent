from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.tasks import FollowUp, Task
from app.schemas.tasks import (
    FollowUpComplete,
    FollowUpCreate,
    FollowUpOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(
    status: str | None = None,
    overdue_only: bool = False,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = db.query(Task).filter(Task.business_id == ctx.business.id)
    if status:
        query = query.filter(Task.status == status)
    if overdue_only:
        now = datetime.now(timezone.utc)
        query = query.filter(Task.status != "DONE", Task.due_date.isnot(None), Task.due_date < now)
    return query.order_by(Task.due_date.asc().nullslast(), Task.created_at.desc()).all()


@router.post("/tasks", response_model=TaskOut, status_code=201)
def create_task(payload: TaskCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    task = Task(business_id=ctx.business.id, created_by="user", **payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.get("/tasks/{task_id}", response_model=TaskOut)
def get_task(task_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.business_id == ctx.business.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(task_id: str, payload: TaskUpdate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.business_id == ctx.business.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/tasks/{task_id}/complete", response_model=TaskOut)
def complete_task(task_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.business_id == ctx.business.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "DONE"
    task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/tasks/{task_id}/reopen", response_model=TaskOut)
def reopen_task(task_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id, Task.business_id == ctx.business.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.status = "OPEN"
    task.completed_at = None
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


# ---------- Follow-ups ----------
@router.get("/follow-ups", response_model=list[FollowUpOut])
def list_follow_ups(
    overdue_only: bool = False,
    status: str | None = None,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    query = db.query(FollowUp).filter(FollowUp.business_id == ctx.business.id)
    if status:
        query = query.filter(FollowUp.status == status)
    if overdue_only:
        now = datetime.now(timezone.utc)
        query = query.filter(FollowUp.status == "PENDING", FollowUp.due_at < now)
    return query.order_by(FollowUp.due_at.asc()).all()


@router.post("/follow-ups", response_model=FollowUpOut, status_code=201)
def create_follow_up(payload: FollowUpCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    follow_up = FollowUp(business_id=ctx.business.id, created_by="user", **payload.model_dump())
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)
    return follow_up


@router.post("/follow-ups/{follow_up_id}/complete", response_model=FollowUpOut)
def complete_follow_up(
    follow_up_id: str, payload: FollowUpComplete,
    ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db),
):
    follow_up = db.query(FollowUp).filter(FollowUp.id == follow_up_id, FollowUp.business_id == ctx.business.id).first()
    if not follow_up:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    follow_up.status = "DONE"
    follow_up.outcome = payload.outcome
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)
    return follow_up
