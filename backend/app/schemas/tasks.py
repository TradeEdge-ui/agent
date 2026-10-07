from datetime import datetime

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str = ""
    priority: str = "MEDIUM"
    due_date: datetime | None = None
    customer_id: str | None = None
    lead_id: str | None = None
    project: str = ""
    assigned_to: str = ""


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    due_date: datetime | None = None
    customer_id: str | None = None
    lead_id: str | None = None
    project: str | None = None
    assigned_to: str | None = None


class TaskOut(BaseModel):
    id: str
    title: str
    description: str
    priority: str
    status: str
    due_date: datetime | None
    customer_id: str | None
    lead_id: str | None
    project: str
    created_by: str
    assigned_to: str
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FollowUpCreate(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    quotation_id: str | None = None
    trigger_at: datetime
    due_at: datetime
    reason: str = ""


class FollowUpOut(BaseModel):
    id: str
    customer_id: str | None
    lead_id: str | None
    quotation_id: str | None
    trigger_at: datetime
    due_at: datetime
    reason: str
    status: str
    outcome: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class FollowUpComplete(BaseModel):
    outcome: str = ""
