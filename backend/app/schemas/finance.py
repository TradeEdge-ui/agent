from datetime import datetime

from pydantic import BaseModel, Field


class LineItemIn(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float = 0.0
    discount_percent: float = 0.0


class LineItemOut(LineItemIn):
    id: str
    line_total: float

    class Config:
        from_attributes = True


class QuotationCreate(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    issue_date: datetime | None = None
    expiry_date: datetime | None = None
    discount_percent: float = 0.0
    tax_percent: float | None = None
    notes: str = ""
    payment_terms: str = ""
    items: list[LineItemIn] = Field(default_factory=list)


class QuotationUpdate(BaseModel):
    customer_id: str | None = None
    expiry_date: datetime | None = None
    discount_percent: float | None = None
    tax_percent: float | None = None
    notes: str | None = None
    payment_terms: str | None = None
    status: str | None = None
    items: list[LineItemIn] | None = None


class QuotationOut(BaseModel):
    id: str
    number: str
    customer_id: str | None
    lead_id: str | None
    issue_date: datetime
    expiry_date: datetime | None
    discount_percent: float
    tax_percent: float
    subtotal: float
    tax_amount: float
    total: float
    notes: str
    payment_terms: str
    status: str
    created_by: str
    items: list[LineItemOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    customer_id: str | None = None
    quotation_id: str | None = None
    issue_date: datetime | None = None
    due_date: datetime | None = None
    discount_percent: float = 0.0
    tax_percent: float | None = None
    notes: str = ""
    payment_terms: str = ""
    items: list[LineItemIn] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    customer_id: str | None = None
    due_date: datetime | None = None
    discount_percent: float | None = None
    tax_percent: float | None = None
    notes: str | None = None
    payment_terms: str | None = None
    status: str | None = None
    amount_paid: float | None = None
    items: list[LineItemIn] | None = None


class InvoiceOut(BaseModel):
    id: str
    number: str
    customer_id: str | None
    quotation_id: str | None
    issue_date: datetime
    due_date: datetime | None
    discount_percent: float
    tax_percent: float
    subtotal: float
    tax_amount: float
    total: float
    amount_paid: float
    notes: str
    payment_terms: str
    payment_status: str
    status: str
    created_by: str
    items: list[LineItemOut]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
