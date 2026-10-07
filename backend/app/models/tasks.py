from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20), default="MEDIUM")  # LOW | MEDIUM | HIGH | URGENT
    status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN | IN_PROGRESS | DONE
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    project: Mapped[str] = mapped_column(String(255), default="")

    created_by: Mapped[str] = mapped_column(String(50), default="user")  # user | agent
    assigned_to: Mapped[str] = mapped_column(String(255), default="")

    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class FollowUp(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "follow_ups"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)
    lead_id: Mapped[str] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    quotation_id: Mapped[str] = mapped_column(ForeignKey("quotations.id"), nullable=True, index=True)

    trigger_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING | DONE | CANCELLED
    outcome: Mapped[str] = mapped_column(Text, default="")

    created_by: Mapped[str] = mapped_column(String(50), default="user")
