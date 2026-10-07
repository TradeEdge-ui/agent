"""Server-side PDF rendering for quotations and invoices using reportlab."""
import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet

from app.models.business import Business
from app.models.crm import Customer
from app.models.finance import Invoice, Quotation


def _header(business: Business, doc_label: str, number: str, status: str, styles) -> list:
    title_style = ParagraphStyle(
        "DocTitle", parent=styles["Heading1"], fontSize=20, spaceAfter=2
    )
    sub_style = ParagraphStyle("DocSub", parent=styles["Normal"], textColor=colors.grey)
    elements = [
        Paragraph(business.name or "Your Business", title_style),
        Paragraph(business.address or "", sub_style),
        Paragraph(
            " | ".join(filter(None, [business.contact_email, business.contact_phone])), sub_style
        ),
        Spacer(1, 10 * mm),
        Paragraph(f"{doc_label} {number}", styles["Heading2"]),
        Paragraph(f"Status: {status}", sub_style),
        Spacer(1, 4 * mm),
    ]
    return elements


def _items_table(items, currency: str) -> Table:
    data = [["Description", "Qty", "Unit Price", "Discount %", "Line Total"]]
    for item in items:
        data.append(
            [
                item.description,
                f"{item.quantity:g}",
                f"{currency} {item.unit_price:,.2f}",
                f"{item.discount_percent:g}%",
                f"{currency} {item.line_total:,.2f}",
            ]
        )
    table = Table(data, colWidths=[70 * mm, 20 * mm, 30 * mm, 25 * mm, 30 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    return table


def _totals_table(subtotal, discount_percent, tax_label, tax_percent, tax_amount, total, currency):
    data = [
        ["Subtotal", f"{currency} {subtotal:,.2f}"],
        [f"Discount ({discount_percent:g}%)", ""],
        [f"{tax_label} ({tax_percent:g}%)", f"{currency} {tax_amount:,.2f}"],
        ["Total", f"{currency} {total:,.2f}"],
    ]
    table = Table(data, colWidths=[130 * mm, 45 * mm])
    table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return table


def render_quotation_pdf(business: Business, quotation: Quotation, customer: Customer | None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"Quotation {quotation.number}")
    styles = getSampleStyleSheet()
    elements = _header(business, "Quotation", quotation.number, quotation.status, styles)
    elements.append(
        Paragraph(
            f"Customer: {customer.name if customer else 'N/A'}", styles["Normal"]
        )
    )
    issue_line = f"Issue date: {quotation.issue_date:%Y-%m-%d}"
    if quotation.expiry_date:
        issue_line += f"  |  Valid until: {quotation.expiry_date:%Y-%m-%d}"
    elements.append(Paragraph(issue_line, styles["Normal"]))
    elements.append(Spacer(1, 6 * mm))
    elements.append(_items_table(quotation.items, business.currency))
    elements.append(Spacer(1, 4 * mm))
    elements.append(
        _totals_table(
            quotation.subtotal,
            quotation.discount_percent,
            business.tax_label,
            quotation.tax_percent,
            quotation.tax_amount,
            quotation.total,
            business.currency,
        )
    )
    if quotation.notes:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph(f"Notes: {quotation.notes}", styles["Normal"]))
    if quotation.payment_terms:
        elements.append(Paragraph(f"Payment terms: {quotation.payment_terms}", styles["Normal"]))
    elements.append(Spacer(1, 10 * mm))
    elements.append(
        Paragraph(
            "This quotation is a draft prepared by the business's AI operations "
            "assistant and is not a tax invoice or legal document.",
            ParagraphStyle("Disclaimer", parent=styles["Normal"], fontSize=7, textColor=colors.grey),
        )
    )
    doc.build(elements)
    return buffer.getvalue()


def render_invoice_pdf(business: Business, invoice: Invoice, customer: Customer | None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"Invoice {invoice.number}")
    styles = getSampleStyleSheet()
    elements = _header(business, "Invoice", invoice.number, invoice.status, styles)
    elements.append(Paragraph(f"Customer: {customer.name if customer else 'N/A'}", styles["Normal"]))
    due = f"  |  Due: {invoice.due_date:%Y-%m-%d}" if invoice.due_date else ""
    elements.append(Paragraph(f"Issue date: {invoice.issue_date:%Y-%m-%d}{due}", styles["Normal"]))
    elements.append(Spacer(1, 6 * mm))
    elements.append(_items_table(invoice.items, business.currency))
    elements.append(Spacer(1, 4 * mm))
    elements.append(
        _totals_table(
            invoice.subtotal,
            invoice.discount_percent,
            business.tax_label,
            invoice.tax_percent,
            invoice.tax_amount,
            invoice.total,
            business.currency,
        )
    )
    elements.append(Spacer(1, 4 * mm))
    elements.append(
        Paragraph(
            f"Amount paid: {business.currency} {invoice.amount_paid:,.2f}  |  "
            f"Payment status: {invoice.payment_status}",
            styles["Normal"],
        )
    )
    if invoice.notes:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph(f"Notes: {invoice.notes}", styles["Normal"]))
    if invoice.payment_terms:
        elements.append(Paragraph(f"Payment terms: {invoice.payment_terms}", styles["Normal"]))
    elements.append(Spacer(1, 10 * mm))
    note = "tax-registered" if business.tax_registered else "not registered for tax purposes"
    elements.append(
        Paragraph(
            f"This business is {note}. This document is an internally generated draft "
            "invoice and may not meet official e-invoicing or legal compliance requirements.",
            ParagraphStyle("Disclaimer", parent=styles["Normal"], fontSize=7, textColor=colors.grey),
        )
    )
    doc.build(elements)
    return buffer.getvalue()
