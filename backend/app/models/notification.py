from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    level: Mapped[str] = mapped_column(String(20), default="info")  # info|warning|action_required
    link: Mapped[str] = mapped_column(String(500), default="")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
