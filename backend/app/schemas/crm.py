from datetime import datetime

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = ""
    phone: str = ""
    company: str = ""
    notes: str = ""
    status: str = "ACTIVE"
    source: str = ""


class CustomerUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    company: str | None = None
    notes: str | None = None
    status: str | None = None
    source: str | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    company: str
    notes: str
    status: str
    source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContactCreate(BaseModel):
    customer_id: str
    name: str
    role: str = ""
    email: str = ""
    phone: str = ""
    notes: str = ""


class ContactOut(BaseModel):
    id: str
    customer_id: str
    name: str
    role: str
    email: str
    phone: str
    notes: str

    class Config:
        from_attributes = True


class LeadCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    customer_id: str | None = None
    value: float = 0.0
    source: str = ""
    status: str = "NEW"
    notes: str = ""
    next_follow_up: datetime | None = None


class LeadUpdate(BaseModel):
    title: str | None = None
    customer_id: str | None = None
    value: float | None = None
    source: str | None = None
    status: str | None = None
    notes: str | None = None
    next_follow_up: datetime | None = None


class LeadOut(BaseModel):
    id: str
    customer_id: str | None
    title: str
    value: float
    source: str
    status: str
    notes: str
    next_follow_up: datetime | None
    last_activity_at: datetime | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InteractionCreate(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    channel: str = "note"
    direction: str = "inbound"
    content: str


class InteractionOut(BaseModel):
    id: str
    customer_id: str | None
    lead_id: str | None
    channel: str
    direction: str
    content: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True
