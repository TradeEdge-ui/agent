from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class AuditLog(Base, UUIDMixin, TimestampMixin):
    """Immutable record of every meaningful AI (and sensitive user) action."""

    __tablename__ = "audit_logs"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), nullable=True, index=True)

    actor: Mapped[str] = mapped_column(String(20), default="user")  # user | agent | system
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    tool_name: Mapped[str] = mapped_column(String(100), default="")
    input_summary: Mapped[str] = mapped_column(Text, default="")
    output_summary: Mapped[str] = mapped_column(Text, default="")
    approval_required: Mapped[bool] = mapped_column(default=False)
    approval_result: Mapped[str] = mapped_column(String(30), default="")
    success: Mapped[bool] = mapped_column(default=True)
    error: Mapped[str] = mapped_column(Text, default="")
