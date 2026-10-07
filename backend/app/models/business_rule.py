from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class BusinessRule(Base, UUIDMixin, TimestampMixin):
    """Durable structured business memory.

    `kind` separates what the system is confident in from what it merely
    infers, so the agent can label statements as FACT / PREFERENCE / RULE /
    ASSUMPTION rather than blur them together. Important rules may only be
    created or changed with explicit user confirmation (see
    services/business_rule_service.py) -- the agent cannot silently rewrite
    one from a casual chat message.
    """

    __tablename__ = "business_rules"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), default="RULE")  # FACT|PREFERENCE|RULE|ASSUMPTION
    key: Mapped[str] = mapped_column(String(120), nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(50), default="user")  # user | agent_suggested
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
