from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class Service(Base, UUIDMixin, TimestampMixin):
    """A reusable product/service catalog entry, used to avoid re-typing prices."""

    __tablename__ = "services"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    default_unit_price: Mapped[float] = mapped_column(Float, default=0.0)


QUOTATION_STATUSES = [
    "DRAFT",
    "PENDING_APPROVAL",
    "APPROVED",
    "SENT",
    "ACCEPTED",
    "REJECTED",
    "EXPIRED",
]


class Quotation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quotations"
    __table_args__ = (UniqueConstraint("business_id", "number", name="uq_quotation_business_number"),)

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    issue_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    discount_percent: Mapped[float] = mapped_column(Float, default=0.0)
    tax_percent: Mapped[float] = mapped_column(Float, default=0.0)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)

    notes: Mapped[str] = mapped_column(Text, default="")
    payment_terms: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")

    created_by: Mapped[str] = mapped_column(String(50), default="user")  # user | agent

    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")


class QuotationItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "quotation_items"

    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    discount_percent: Mapped[float] = mapped_column(Float, default=0.0)
    line_total: Mapped[float] = mapped_column(Float, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    quotation = relationship("Quotation", back_populates="items")


INVOICE_STATUSES = [
    "DRAFT",
    "PENDING_APPROVAL",
    "ISSUED",
    "PARTIALLY_PAID",
    "PAID",
    "OVERDUE",
    "CANCELLED",
]


class Invoice(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoices"
    __table_args__ = (UniqueConstraint("business_id", "number", name="uq_invoice_business_number"),)

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id"), nullable=True, index=True)

    number: Mapped[str] = mapped_column(String(50), nullable=False)
    issue_date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    discount_percent: Mapped[float] = mapped_column(Float, default=0.0)
    tax_percent: Mapped[float] = mapped_column(Float, default=0.0)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    amount_paid: Mapped[float] = mapped_column(Float, default=0.0)

    notes: Mapped[str] = mapped_column(Text, default="")
    payment_terms: Mapped[str] = mapped_column(String(255), default="")
    payment_status: Mapped[str] = mapped_column(String(30), default="UNPAID")  # UNPAID|PARTIAL|PAID
    status: Mapped[str] = mapped_column(String(30), default="DRAFT")

    created_by: Mapped[str] = mapped_column(String(50), default="user")

    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[str] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit_price: Mapped[float] = mapped_column(Float, default=0.0)
    discount_percent: Mapped[float] = mapped_column(Float, default=0.0)
    line_total: Mapped[float] = mapped_column(Float, default=0.0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    invoice = relationship("Invoice", back_populates="items")
