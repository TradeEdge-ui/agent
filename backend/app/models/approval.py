from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin

APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EDITED_APPROVED"]
RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"]


class Approval(Base, UUIDMixin, TimestampMixin):
    """A pending high-impact action awaiting explicit human sign-off.

    Holds everything the approval screen needs to render without further
    lookups: the action, why it's being proposed, the data behind it, the
    expected result, and a risk level.
    """

    __tablename__ = "approvals"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), nullable=True, index=True)

    action: Mapped[str] = mapped_column(String(255), nullable=False)
    reason: Mapped[str] = mapped_column(Text, default="")
    data_json: Mapped[str] = mapped_column(Text, default="{}")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    risk_level: Mapped[str] = mapped_column(String(20), default="MEDIUM")

    tool_name: Mapped[str] = mapped_column(String(100), default="")
    tool_input_json: Mapped[str] = mapped_column(Text, default="{}")

    status: Mapped[str] = mapped_column(String(30), default="PENDING")
    decided_by: Mapped[str] = mapped_column(String(255), default="")
    decision_notes: Mapped[str] = mapped_column(Text, default="")
    edited_input_json: Mapped[str] = mapped_column(Text, nullable=True)
