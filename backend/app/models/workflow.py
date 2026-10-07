from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin

WORKFLOW_TRIGGER_TYPES = ["MANUAL", "CRON"]
WORKFLOW_RUN_STATUSES = ["RUNNING", "COMPLETED", "FAILED"]
WORKFLOW_STEP_TYPES = ["TOOL_CALL", "CONDITION"]


class Workflow(Base, UUIDMixin, TimestampMixin):
    """A reusable routine: TRIGGER -> ACTION -> CONDITION -> ACTION -> RESULT
    (spec #37/#38). Steps may only call LOW-risk, non-approval tools -- a
    workflow runs unattended, so anything that would normally stop for human
    sign-off has no place in one (enforced in workflow_service)."""

    __tablename__ = "workflows"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    trigger_type: Mapped[str] = mapped_column(String(20), default="MANUAL")  # MANUAL | CRON
    cron_expression: Mapped[str] = mapped_column(String(100), default="")
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = mapped_column(String(50), default="user")  # user | agent

    steps: Mapped[list["WorkflowStep"]] = relationship(
        "WorkflowStep", back_populates="workflow", cascade="all, delete-orphan",
        order_by="WorkflowStep.order",
    )
    runs: Mapped[list["WorkflowRun"]] = relationship(
        "WorkflowRun", back_populates="workflow", cascade="all, delete-orphan"
    )


class WorkflowStep(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workflow_steps"

    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), nullable=False, index=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    step_type: Mapped[str] = mapped_column(String(20), default="TOOL_CALL")  # TOOL_CALL | CONDITION

    tool_name: Mapped[str] = mapped_column(String(100), default="")
    tool_input_json: Mapped[str] = mapped_column(Text, default="{}")

    # CONDITION: compares a dotted field path in the PREVIOUS step's tool
    # output against condition_value using condition_operator.
    condition_field: Mapped[str] = mapped_column(String(255), default="")
    condition_operator: Mapped[str] = mapped_column(String(20), default="eq")  # eq|ne|gt|lt|contains|exists
    condition_value: Mapped[str] = mapped_column(String(500), default="")
    on_false: Mapped[str] = mapped_column(String(20), default="stop")  # stop | skip_next

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="steps")


class WorkflowRun(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "workflow_runs"

    workflow_id: Mapped[str] = mapped_column(ForeignKey("workflows.id"), nullable=False, index=True)
    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), default="RUNNING")  # RUNNING|COMPLETED|FAILED
    triggered_by: Mapped[str] = mapped_column(String(50), default="user")  # user | scheduler | agent
    step_results_json: Mapped[str] = mapped_column(Text, default="[]")
    error: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="runs")
