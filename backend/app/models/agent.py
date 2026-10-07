from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin

AGENT_RUN_STATUSES = [
    "PENDING",
    "RUNNING",
    "WAITING_FOR_APPROVAL",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
]


class AgentRun(Base, UUIDMixin, TimestampMixin):
    """One execution of the agent loop for a single user request."""

    __tablename__ = "agent_runs"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    request_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="PENDING")
    current_step: Mapped[str] = mapped_column(String(255), default="")
    iteration_count: Mapped[int] = mapped_column(Integer, default=0)

    final_response: Mapped[str] = mapped_column(Text, default="")
    error: Mapped[str] = mapped_column(Text, default="")

    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    messages = relationship("AgentMessage", back_populates="run", cascade="all, delete-orphan")
    tool_executions = relationship("ToolExecution", back_populates="run", cascade="all, delete-orphan")


class AgentMessage(Base, UUIDMixin, TimestampMixin):
    """A single turn in the agent's reasoning trace (for transparency/audit)."""

    __tablename__ = "agent_messages"

    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # user|assistant|tool|system
    content: Mapped[str] = mapped_column(Text, default="")

    run = relationship("AgentRun", back_populates="messages")


class ToolExecution(Base, UUIDMixin, TimestampMixin):
    """A single validated tool call made by the agent, with its result."""

    __tablename__ = "tool_executions"

    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), nullable=False, index=True)
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    output_json: Mapped[str] = mapped_column(Text, default="{}")
    success: Mapped[bool] = mapped_column(default=True)
    error: Mapped[str] = mapped_column(Text, default="")
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    required_approval: Mapped[bool] = mapped_column(default=False)
    approval_id: Mapped[str] = mapped_column(ForeignKey("approvals.id"), nullable=True)

    run = relationship("AgentRun", back_populates="tool_executions")
