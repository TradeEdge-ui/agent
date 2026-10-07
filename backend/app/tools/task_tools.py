from datetime import datetime, timedelta, timezone

from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.tasks import FollowUp, Task
from app.tools.registry import ToolError, tool


class SearchTasksInput(BaseModel):
    status: str | None = None
    query: str = ""


@tool("search_tasks", "Search tasks, optionally filtered by status (OPEN, IN_PROGRESS, DONE).", SearchTasksInput)
def search_tasks(db: Session, business: Business, user_id: str, params: SearchTasksInput) -> dict:
    q = db.query(Task).filter(Task.business_id == business.id)
    if params.status:
        q = q.filter(Task.status == params.status)
    if params.query:
        q = q.filter(Task.title.ilike(f"%{params.query}%"))
    results = q.order_by(Task.due_date.asc().nullslast()).limit(30).all()
    return {
        "tasks": [
            {"id": t.id, "title": t.title, "status": t.status, "priority": t.priority,
             "due_date": t.due_date.isoformat() if t.due_date else None}
            for t in results
        ]
    }


class CreateTaskInput(BaseModel):
    title: str
    description: str = ""
    priority: str = "MEDIUM"
    due_date: datetime | None = None
    customer_id: str | None = None
    lead_id: str | None = None


@tool("create_task", "Create an internal task, optionally linked to a customer or lead.", CreateTaskInput, risk="LOW", write=True)
def create_task(db: Session, business: Business, user_id: str, params: CreateTaskInput) -> dict:
    task = Task(business_id=business.id, created_by="agent", **params.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "title": task.title, "created": True}


class UpdateTaskInput(BaseModel):
    task_id: str
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    due_date: datetime | None = None


@tool("update_task", "Update an existing task's fields.", UpdateTaskInput, risk="LOW", write=True)
def update_task(db: Session, business: Business, user_id: str, params: UpdateTaskInput) -> dict:
    task = db.query(Task).filter(Task.id == params.task_id, Task.business_id == business.id).first()
    if not task:
        raise ToolError(f"No task found with id {params.task_id}")
    data = params.model_dump(exclude_unset=True, exclude={"task_id"})
    for field, value in data.items():
        if value is not None:
            setattr(task, field, value)
    db.add(task)
    db.commit()
    return {"id": task.id, "updated_fields": list(data.keys())}


class CompleteTaskInput(BaseModel):
    task_id: str


@tool("complete_task", "Mark a task as done.", CompleteTaskInput, risk="LOW", write=True)
def complete_task(db: Session, business: Business, user_id: str, params: CompleteTaskInput) -> dict:
    task = db.query(Task).filter(Task.id == params.task_id, Task.business_id == business.id).first()
    if not task:
        raise ToolError(f"No task found with id {params.task_id}")
    task.status = "DONE"
    task.completed_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    return {"id": task.id, "status": "DONE"}


class CreateFollowUpInput(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    quotation_id: str | None = None
    days_from_now: int = 3
    reason: str = ""


@tool(
    "create_follow_up", "Schedule a follow-up reminder N days from now for a customer, lead or quotation.",
    CreateFollowUpInput, risk="LOW", write=True,
)
def create_follow_up(db: Session, business: Business, user_id: str, params: CreateFollowUpInput) -> dict:
    if not any([params.customer_id, params.lead_id, params.quotation_id]):
        raise ToolError("A follow-up must reference a customer, lead, or quotation")
    now = datetime.now(timezone.utc)
    due = now + timedelta(days=params.days_from_now)
    follow_up = FollowUp(
        business_id=business.id, customer_id=params.customer_id, lead_id=params.lead_id,
        quotation_id=params.quotation_id, trigger_at=now, due_at=due, reason=params.reason,
        created_by="agent",
    )
    db.add(follow_up)
    db.commit()
    db.refresh(follow_up)
    return {"id": follow_up.id, "due_at": due.isoformat(), "created": True}


class FindOverdueFollowUpsInput(BaseModel):
    pass


@tool("find_overdue_follow_ups", "List follow-ups that are overdue (past their due date, still pending).", FindOverdueFollowUpsInput)
def find_overdue_follow_ups(db: Session, business: Business, user_id: str, params: FindOverdueFollowUpsInput) -> dict:
    now = datetime.now(timezone.utc)
    results = (
        db.query(FollowUp)
        .filter(FollowUp.business_id == business.id, FollowUp.status == "PENDING", FollowUp.due_at < now)
        .order_by(FollowUp.due_at.asc())
        .all()
    )
    return {
        "overdue_follow_ups": [
            {"id": f.id, "customer_id": f.customer_id, "lead_id": f.lead_id, "reason": f.reason,
             "due_at": f.due_at.isoformat()}
            for f in results
        ]
    }
