"""Sequential document numbering (QT-0001, INV-0001, ...) scoped per business."""
from sqlalchemy.orm import Session

from app.models.business import Business


def next_quotation_number(db: Session, business: Business) -> str:
    seq = business.next_quotation_sequence
    business.next_quotation_sequence = seq + 1
    db.add(business)
    db.commit()
    return f"{business.quotation_numbering_prefix}-{seq:04d}"


def next_invoice_number(db: Session, business: Business) -> str:
    seq = business.next_invoice_sequence
    business.next_invoice_sequence = seq + 1
    db.add(business)
    db.commit()
    return f"{business.invoice_numbering_prefix}-{seq:04d}"
