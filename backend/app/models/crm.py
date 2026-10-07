from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class Customer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "customers"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    company: Mapped[str] = mapped_column(String(255), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")  # ACTIVE | INACTIVE
    source: Mapped[str] = mapped_column(String(100), default="")

    contacts = relationship("Contact", back_populates="customer", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="customer", cascade="all, delete-orphan")


class Contact(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "contacts"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(120), default="")
    email: Mapped[str] = mapped_column(String(255), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    notes: Mapped[str] = mapped_column(Text, default="")

    customer = relationship("Customer", back_populates="contacts")


LEAD_STAGES = ["NEW", "QUALIFIED", "QUOTED", "NEGOTIATING", "WON", "LOST"]


class Lead(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "leads"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(100), default="")
    status: Mapped[str] = mapped_column(String(30), default="NEW")
    notes: Mapped[str] = mapped_column(Text, default="")
    next_follow_up: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customer = relationship("Customer", back_populates="leads")
    interactions = relationship("Interaction", back_populates="lead", cascade="all, delete-orphan")


class Interaction(Base, UUIDMixin, TimestampMixin):
    """A logged touch point: a customer message, a call note, an email, etc.

    External content captured here (e.g. a pasted customer message) is stored
    verbatim as DATA. It is never treated as an instruction to the agent.
    """

    __tablename__ = "interactions"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    channel: Mapped[str] = mapped_column(String(50), default="note")  # note | email | call | message
    direction: Mapped[str] = mapped_column(String(20), default="inbound")  # inbound | outbound
    content: Mapped[str] = mapped_column(Text, default="")
    created_by: Mapped[str] = mapped_column(String(50), default="user")  # user | agent

    lead = relationship("Lead", back_populates="interactions")
