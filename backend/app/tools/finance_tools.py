from datetime import datetime

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.finance import Invoice, Quotation
from app.services import finance_service
from app.tools.registry import ToolError, tool


class LineItem(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price: float
    discount_percent: float = 0.0


class CalculateQuoteTotalInput(BaseModel):
    items: list[LineItem]
    discount_percent: float = 0.0
    tax_percent: float = 0.0


@tool(
    "calculate_quote_total", "Calculate subtotal, tax and total for a set of line items without saving "
    "anything. Always use this instead of doing arithmetic yourself.", CalculateQuoteTotalInput,
)
def calculate_quote_total(db: Session, business: Business, user_id: str, params: CalculateQuoteTotalInput) -> dict:
    items = [i.model_dump() for i in params.items]
    subtotal, tax_amount, total = finance_service.compute_totals(items, params.discount_percent, params.tax_percent)
    return {"subtotal": subtotal, "tax_amount": tax_amount, "total": total}


class CreateQuoteInput(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    items: list[LineItem] = Field(default_factory=list)
    discount_percent: float = 0.0
    tax_percent: float | None = None
    notes: str = ""
    payment_terms: str = ""
    validity_days: int | None = None


@tool(
    "create_quote", "Create a draft quotation for a customer with line items. Prices must come from the "
    "user, the service catalog, or business rules -- never invent a price.", CreateQuoteInput,
    risk="LOW", write=True,
)
def create_quote(db: Session, business: Business, user_id: str, params: CreateQuoteInput) -> dict:
    if not params.items:
        raise ToolError("At least one line item with a known price is required to create a quotation")
    expiry = None
    if params.validity_days:
        from datetime import timedelta, timezone
        expiry = datetime.now(timezone.utc) + timedelta(days=params.validity_days)
    quotation = finance_service.create_quotation(
        db, business, customer_id=params.customer_id, lead_id=params.lead_id,
        items=[i.model_dump() for i in params.items], expiry_date=expiry,
        discount_percent=params.discount_percent, tax_percent=params.tax_percent,
        notes=params.notes, payment_terms=params.payment_terms, created_by="agent",
    )
    return {"id": quotation.id, "number": quotation.number, "total": quotation.total, "status": quotation.status}


class GetQuoteInput(BaseModel):
    quote_id: str


@tool("get_quote", "Get full details of a quotation by id.", GetQuoteInput)
def get_quote(db: Session, business: Business, user_id: str, params: GetQuoteInput) -> dict:
    q = db.query(Quotation).filter(Quotation.id == params.quote_id, Quotation.business_id == business.id).first()
    if not q:
        raise ToolError(f"No quotation found with id {params.quote_id}")
    return {
        "id": q.id, "number": q.number, "status": q.status, "total": q.total,
        "customer_id": q.customer_id, "items": [
            {"description": i.description, "quantity": i.quantity, "unit_price": i.unit_price, "line_total": i.line_total}
            for i in q.items
        ],
    }


class UpdateQuoteInput(BaseModel):
    quote_id: str
    items: list[LineItem] | None = None
    discount_percent: float | None = None
    tax_percent: float | None = None
    notes: str | None = None


@tool("update_quote", "Update line items, discount, tax or notes on an existing draft quotation.", UpdateQuoteInput, risk="MEDIUM", write=True)
def update_quote(db: Session, business: Business, user_id: str, params: UpdateQuoteInput) -> dict:
    q = db.query(Quotation).filter(Quotation.id == params.quote_id, Quotation.business_id == business.id).first()
    if not q:
        raise ToolError(f"No quotation found with id {params.quote_id}")
    if q.status not in ("DRAFT", "PENDING_APPROVAL"):
        raise ToolError(f"Cannot modify a quotation in status {q.status}")
    if params.notes is not None:
        q.notes = params.notes
        db.add(q)
    items = [i.model_dump() for i in params.items] if params.items is not None else None
    q = finance_service.update_quotation_items(db, q, items, params.discount_percent, params.tax_percent)
    return {"id": q.id, "total": q.total, "status": q.status}


class SubmitQuoteForApprovalInput(BaseModel):
    quote_id: str


@tool(
    "submit_quote_for_approval", "Move a draft quotation into PENDING_APPROVAL so the business owner can "
    "review and approve it.", SubmitQuoteForApprovalInput, risk="LOW", write=True,
)
def submit_quote_for_approval(db: Session, business: Business, user_id: str, params: SubmitQuoteForApprovalInput) -> dict:
    q = db.query(Quotation).filter(Quotation.id == params.quote_id, Quotation.business_id == business.id).first()
    if not q:
        raise ToolError(f"No quotation found with id {params.quote_id}")
    if q.status != "DRAFT":
        raise ToolError(f"Only DRAFT quotations can be submitted for approval (current: {q.status})")
    q.status = "PENDING_APPROVAL"
    db.add(q)
    db.commit()
    return {"id": q.id, "status": q.status}


class CreateInvoiceDraftInput(BaseModel):
    customer_id: str | None = None
    quotation_id: str | None = None
    items: list[LineItem] = Field(default_factory=list)
    discount_percent: float = 0.0
    tax_percent: float | None = None
    notes: str = ""
    payment_terms: str = ""


@tool(
    "create_invoice_draft", "Create a draft invoice for a customer with line items. This never issues or "
    "sends the invoice -- it only creates an internal draft.", CreateInvoiceDraftInput, risk="LOW", write=True,
)
def create_invoice_draft(db: Session, business: Business, user_id: str, params: CreateInvoiceDraftInput) -> dict:
    if not params.items:
        raise ToolError("At least one line item is required to create an invoice draft")
    invoice = finance_service.create_invoice(
        db, business, customer_id=params.customer_id, quotation_id=params.quotation_id,
        items=[i.model_dump() for i in params.items], discount_percent=params.discount_percent,
        tax_percent=params.tax_percent, notes=params.notes, payment_terms=params.payment_terms,
        created_by="agent",
    )
    return {"id": invoice.id, "number": invoice.number, "total": invoice.total, "status": invoice.status}


class GetInvoiceInput(BaseModel):
    invoice_id: str


@tool("get_invoice", "Get full details of an invoice by id.", GetInvoiceInput)
def get_invoice(db: Session, business: Business, user_id: str, params: GetInvoiceInput) -> dict:
    inv = db.query(Invoice).filter(Invoice.id == params.invoice_id, Invoice.business_id == business.id).first()
    if not inv:
        raise ToolError(f"No invoice found with id {params.invoice_id}")
    return {
        "id": inv.id, "number": inv.number, "status": inv.status, "total": inv.total,
        "payment_status": inv.payment_status, "customer_id": inv.customer_id,
    }


class CalculateInvoiceTotalInput(BaseModel):
    items: list[LineItem]
    discount_percent: float = 0.0
    tax_percent: float = 0.0


@tool("calculate_invoice_total", "Calculate subtotal, tax and total for invoice line items without saving.", CalculateInvoiceTotalInput)
def calculate_invoice_total(db: Session, business: Business, user_id: str, params: CalculateInvoiceTotalInput) -> dict:
    items = [i.model_dump() for i in params.items]
    subtotal, tax_amount, total = finance_service.compute_totals(items, params.discount_percent, params.tax_percent)
    return {"subtotal": subtotal, "tax_amount": tax_amount, "total": total}


class IssueInvoiceInput(BaseModel):
    invoice_id: str


@tool(
    "issue_invoice", "Finalize and issue an invoice to the customer. This is a financial action that "
    "always requires explicit human approval.", IssueInvoiceInput, risk="HIGH", write=True,
)
def issue_invoice(db: Session, business: Business, user_id: str, params: IssueInvoiceInput) -> dict:
    inv = db.query(Invoice).filter(Invoice.id == params.invoice_id, Invoice.business_id == business.id).first()
    if not inv:
        raise ToolError(f"No invoice found with id {params.invoice_id}")
    if inv.status not in ("DRAFT", "PENDING_APPROVAL"):
        raise ToolError(f"Cannot issue invoice in status {inv.status}")
    inv.status = "ISSUED"
    db.add(inv)
    db.commit()
    return {"id": inv.id, "status": inv.status}
