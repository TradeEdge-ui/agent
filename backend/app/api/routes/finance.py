from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.crm import Customer
from app.models.finance import Invoice, Quotation
from app.schemas.finance import (
    InvoiceCreate,
    InvoiceOut,
    InvoiceUpdate,
    QuotationCreate,
    QuotationOut,
    QuotationUpdate,
)
from app.services import finance_service, pdf_service
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/api", tags=["finance"])

QUOTATION_TRANSITIONS = {
    "DRAFT": {"PENDING_APPROVAL", "REJECTED"},
    "PENDING_APPROVAL": {"APPROVED", "REJECTED", "DRAFT"},
    "APPROVED": {"SENT", "REJECTED"},
    "SENT": {"ACCEPTED", "REJECTED", "EXPIRED"},
    "ACCEPTED": set(),
    "REJECTED": set(),
    "EXPIRED": set(),
}

INVOICE_TRANSITIONS = {
    "DRAFT": {"PENDING_APPROVAL", "CANCELLED"},
    "PENDING_APPROVAL": {"ISSUED", "CANCELLED", "DRAFT"},
    "ISSUED": {"PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"},
    "PARTIALLY_PAID": {"PAID", "OVERDUE", "CANCELLED"},
    "PAID": set(),
    "OVERDUE": {"PARTIALLY_PAID", "PAID", "CANCELLED"},
    "CANCELLED": set(),
}


# ---------- Quotations ----------
@router.get("/quotes", response_model=list[QuotationOut])
def list_quotes(status: str | None = None, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    query = db.query(Quotation).filter(Quotation.business_id == ctx.business.id)
    if status:
        query = query.filter(Quotation.status == status)
    return query.order_by(Quotation.created_at.desc()).all()


@router.post("/quotes", response_model=QuotationOut, status_code=201)
def create_quote(payload: QuotationCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    quotation = finance_service.create_quotation(
        db, ctx.business,
        customer_id=payload.customer_id, lead_id=payload.lead_id,
        items=[i.model_dump() for i in payload.items],
        issue_date=payload.issue_date, expiry_date=payload.expiry_date,
        discount_percent=payload.discount_percent, tax_percent=payload.tax_percent,
        notes=payload.notes, payment_terms=payload.payment_terms, created_by="user",
    )
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Created quotation {quotation.number}", output_summary=f"Total: {quotation.total}",
    )
    return quotation


@router.get("/quotes/{quote_id}", response_model=QuotationOut)
def get_quote(quote_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    quote = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.business_id == ctx.business.id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return quote


@router.patch("/quotes/{quote_id}", response_model=QuotationOut)
def update_quote(quote_id: str, payload: QuotationUpdate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    quote = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.business_id == ctx.business.id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] != quote.status:
        allowed = QUOTATION_TRANSITIONS.get(quote.status, set())
        if data["status"] not in allowed:
            raise HTTPException(status_code=400, detail=f"Cannot transition {quote.status} -> {data['status']}")
        quote.status = data["status"]

    for field in ("customer_id", "notes", "payment_terms", "expiry_date"):
        if field in data:
            setattr(quote, field, data[field])

    items = [i.model_dump() if hasattr(i, "model_dump") else i for i in data["items"]] if "items" in data else None
    quote = finance_service.update_quotation_items(
        db, quote, items, data.get("discount_percent"), data.get("tax_percent")
    )
    return quote


@router.get("/quotes/{quote_id}/pdf")
def download_quote_pdf(quote_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    quote = db.query(Quotation).filter(Quotation.id == quote_id, Quotation.business_id == ctx.business.id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found")
    customer = db.get(Customer, quote.customer_id) if quote.customer_id else None
    pdf_bytes = pdf_service.render_quotation_pdf(ctx.business, quote, customer)
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{quote.number}.pdf"'},
    )


# ---------- Invoices ----------
@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(status: str | None = None, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    query = db.query(Invoice).filter(Invoice.business_id == ctx.business.id)
    if status:
        query = query.filter(Invoice.status == status)
    return query.order_by(Invoice.created_at.desc()).all()


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
def create_invoice(payload: InvoiceCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    invoice = finance_service.create_invoice(
        db, ctx.business,
        customer_id=payload.customer_id, quotation_id=payload.quotation_id,
        items=[i.model_dump() for i in payload.items],
        issue_date=payload.issue_date, due_date=payload.due_date,
        discount_percent=payload.discount_percent, tax_percent=payload.tax_percent,
        notes=payload.notes, payment_terms=payload.payment_terms, created_by="user",
    )
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Created invoice draft {invoice.number}", output_summary=f"Total: {invoice.total}",
    )
    return invoice


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.business_id == ctx.business.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: str, payload: InvoiceUpdate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.business_id == ctx.business.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    data = payload.model_dump(exclude_unset=True)

    if "status" in data and data["status"] != invoice.status:
        allowed = INVOICE_TRANSITIONS.get(invoice.status, set())
        if data["status"] not in allowed:
            raise HTTPException(status_code=400, detail=f"Cannot transition {invoice.status} -> {data['status']}")
        invoice.status = data["status"]

    for field in ("customer_id", "notes", "payment_terms", "due_date"):
        if field in data:
            setattr(invoice, field, data[field])

    if "amount_paid" in data:
        invoice.amount_paid = data["amount_paid"]
        if invoice.amount_paid >= invoice.total and invoice.total > 0:
            invoice.payment_status = "PAID"
            invoice.status = "PAID"
        elif invoice.amount_paid > 0:
            invoice.payment_status = "PARTIAL"
            invoice.status = "PARTIALLY_PAID"

    items = [i.model_dump() if hasattr(i, "model_dump") else i for i in data["items"]] if "items" in data else None
    invoice = finance_service.update_invoice_items(
        db, invoice, items, data.get("discount_percent"), data.get("tax_percent")
    )
    return invoice


@router.get("/invoices/{invoice_id}/pdf")
def download_invoice_pdf(invoice_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.business_id == ctx.business.id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    customer = db.get(Customer, invoice.customer_id) if invoice.customer_id else None
    pdf_bytes = pdf_service.render_invoice_pdf(ctx.business, invoice, customer)
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{invoice.number}.pdf"'},
    )
