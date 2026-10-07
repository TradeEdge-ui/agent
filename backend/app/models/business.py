from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class Business(Base, UUIDMixin, TimestampMixin):
    """A business/tenant. Every operational record belongs to exactly one Business."""

    __tablename__ = "businesses"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    industry: Mapped[str] = mapped_column(String(120), default="")
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    timezone: Mapped[str] = mapped_column(String(64), default="UTC")

    contact_email: Mapped[str] = mapped_column(String(255), default="")
    contact_phone: Mapped[str] = mapped_column(String(50), default="")
    address: Mapped[str] = mapped_column(Text, default="")

    default_quotation_validity_days: Mapped[int] = mapped_column(Integer, default=7)
    default_payment_terms: Mapped[str] = mapped_column(String(255), default="Due on receipt")
    invoice_numbering_prefix: Mapped[str] = mapped_column(String(20), default="INV")
    quotation_numbering_prefix: Mapped[str] = mapped_column(String(20), default="QT")
    next_invoice_sequence: Mapped[int] = mapped_column(Integer, default=1)
    next_quotation_sequence: Mapped[int] = mapped_column(Integer, default=1)

    tax_label: Mapped[str] = mapped_column(String(50), default="Tax")
    tax_rate_percent: Mapped[float] = mapped_column(Float, default=0.0)
    tax_registered: Mapped[bool] = mapped_column(default=False)

    communication_style: Mapped[str] = mapped_column(String(50), default="professional")

    # Agent / AI settings
    autonomy_level: Mapped[str] = mapped_column(String(20), default="DRAFT")  # SUGGEST | DRAFT | EXECUTE
    ai_provider: Mapped[str] = mapped_column(String(50), default="ollama")
    ai_model: Mapped[str] = mapped_column(String(100), default="llama3.1")

    stale_lead_days_threshold: Mapped[int] = mapped_column(Integer, default=5)

    onboarding_completed: Mapped[bool] = mapped_column(default=False)

    members = relationship("BusinessMember", back_populates="business", cascade="all, delete-orphan")


class BusinessMember(Base, UUIDMixin, TimestampMixin):
    """Links a User to a Business with a role. Enables multi-user expansion."""

    __tablename__ = "business_members"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), default="OWNER")  # OWNER | ADMIN | USER

    business = relationship("Business", back_populates="members")
    user = relationship("User", back_populates="memberships")
