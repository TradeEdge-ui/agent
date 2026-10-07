"""Quotation and invoice calculation + CRUD logic.

Kept as plain functions (not a class) because the agent tools and the API
routers both need the exact same calculation path -- there must be only one
place totals are computed, so a quote shown to the user and a quote the
agent creates can never silently disagree.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.finance import Invoice, InvoiceItem, Quotation, QuotationItem
from app.services.numbering_service import next_invoice_number, next_quotation_number


def compute_line_total(quantity: float, unit_price: float, discount_percent: float) -> float:
    gross = quantity * unit_price
    discount = gross * (discount_percent / 100.0)
    return round(gross - discount, 2)


def compute_totals(
    items: list[dict], header_discount_percent: float, tax_percent: float
) -> tuple[float, float, float]:
    subtotal = sum(
        compute_line_total(i["quantity"], i["unit_price"], i.get("discount_percent", 0.0))
        for i in items
    )
    after_discount = subtotal * (1 - header_discount_percent / 100.0)
    tax_amount = round(after_discount * (tax_percent / 100.0), 2)
    total = round(after_discount + tax_amount, 2)
    return round(subtotal, 2), tax_amount, total


def create_quotation(
    db: Session,
    business: Business,
    *,
    customer_id: str | None,
    lead_id: str | None,
    items: list[dict],
    issue_date: datetime | None = None,
    expiry_date: datetime | None = None,
    discount_percent: float = 0.0,
    tax_percent: float | None = None,
    notes: str = "",
    payment_terms: str = "",
    created_by: str = "user",
) -> Quotation:
    issue = issue_date or datetime.now(timezone.utc)
    expiry = expiry_date or (issue + timedelta(days=business.default_quotation_validity_days))
    tax = tax_percent if tax_percent is not None else business.tax_rate_percent
    subtotal, tax_amount, total = compute_totals(items, discount_percent, tax)

    quotation = Quotation(
        business_id=business.id,
        customer_id=customer_id,
        lead_id=lead_id,
        number=next_quotation_number(db, business),
        issue_date=issue,
        expiry_date=expiry,
        discount_percent=discount_percent,
        tax_percent=tax,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        notes=notes,
        payment_terms=payment_terms or business.default_payment_terms,
        status="DRAFT",
        created_by=created_by,
    )
    db.add(quotation)
    db.flush()
    for idx, item in enumerate(items):
        db.add(
            QuotationItem(
                quotation_id=quotation.id,
                description=item["description"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                discount_percent=item.get("discount_percent", 0.0),
                line_total=compute_line_total(
                    item["quantity"], item["unit_price"], item.get("discount_percent", 0.0)
                ),
                sort_order=idx,
            )
        )
    db.commit()
    db.refresh(quotation)
    return quotation


def update_quotation_items(
    db: Session,
    quotation: Quotation,
    items: list[dict] | None,
    discount_percent: float | None,
    tax_percent: float | None,
) -> Quotation:
    if items is not None:
        for existing in list(quotation.items):
            db.delete(existing)
        db.flush()
        for idx, item in enumerate(items):
            db.add(
                QuotationItem(
                    quotation_id=quotation.id,
                    description=item["description"],
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    discount_percent=item.get("discount_percent", 0.0),
                    line_total=compute_line_total(
                        item["quantity"], item["unit_price"], item.get("discount_percent", 0.0)
                    ),
                    sort_order=idx,
                )
            )
        db.flush()

    if discount_percent is not None:
        quotation.discount_percent = discount_percent
    if tax_percent is not None:
        quotation.tax_percent = tax_percent

    db.flush()
    db.refresh(quotation)
    item_dicts = [
        {
            "quantity": i.quantity,
            "unit_price": i.unit_price,
            "discount_percent": i.discount_percent,
        }
        for i in quotation.items
    ]
    subtotal, tax_amount, total = compute_totals(
        item_dicts, quotation.discount_percent, quotation.tax_percent
    )
    quotation.subtotal = subtotal
    quotation.tax_amount = tax_amount
    quotation.total = total
    db.add(quotation)
    db.commit()
    db.refresh(quotation)
    return quotation


def create_invoice(
    db: Session,
    business: Business,
    *,
    customer_id: str | None,
    quotation_id: str | None,
    items: list[dict],
    issue_date: datetime | None = None,
    due_date: datetime | None = None,
    discount_percent: float = 0.0,
    tax_percent: float | None = None,
    notes: str = "",
    payment_terms: str = "",
    created_by: str = "user",
) -> Invoice:
    issue = issue_date or datetime.now(timezone.utc)
    due = due_date or (issue + timedelta(days=14))
    tax = tax_percent if tax_percent is not None else business.tax_rate_percent
    subtotal, tax_amount, total = compute_totals(items, discount_percent, tax)

    invoice = Invoice(
        business_id=business.id,
        customer_id=customer_id,
        quotation_id=quotation_id,
        number=next_invoice_number(db, business),
        issue_date=issue,
        due_date=due,
        discount_percent=discount_percent,
        tax_percent=tax,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        notes=notes,
        payment_terms=payment_terms or business.default_payment_terms,
        status="DRAFT",
        payment_status="UNPAID",
        created_by=created_by,
    )
    db.add(invoice)
    db.flush()
    for idx, item in enumerate(items):
        db.add(
            InvoiceItem(
                invoice_id=invoice.id,
                description=item["description"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                discount_percent=item.get("discount_percent", 0.0),
                line_total=compute_line_total(
                    item["quantity"], item["unit_price"], item.get("discount_percent", 0.0)
                ),
                sort_order=idx,
            )
        )
    db.commit()
    db.refresh(invoice)
    return invoice


def update_invoice_items(
    db: Session,
    invoice: Invoice,
    items: list[dict] | None,
    discount_percent: float | None,
    tax_percent: float | None,
) -> Invoice:
    if items is not None:
        for existing in list(invoice.items):
            db.delete(existing)
        db.flush()
        for idx, item in enumerate(items):
            db.add(
                InvoiceItem(
                    invoice_id=invoice.id,
                    description=item["description"],
                    quantity=item["quantity"],
                    unit_price=item["unit_price"],
                    discount_percent=item.get("discount_percent", 0.0),
                    line_total=compute_line_total(
                        item["quantity"], item["unit_price"], item.get("discount_percent", 0.0)
                    ),
                    sort_order=idx,
                )
            )
        db.flush()

    if discount_percent is not None:
        invoice.discount_percent = discount_percent
    if tax_percent is not None:
        invoice.tax_percent = tax_percent

    db.flush()
    db.refresh(invoice)
    item_dicts = [
        {
            "quantity": i.quantity,
            "unit_price": i.unit_price,
            "discount_percent": i.discount_percent,
        }
        for i in invoice.items
    ]
    subtotal, tax_amount, total = compute_totals(
        item_dicts, invoice.discount_percent, invoice.tax_percent
    )
    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total = total
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice
