from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class Document(Base, UUIDMixin, TimestampMixin):
    """An uploaded business document (receipt, quotation PDF, customer file, etc.)."""

    __tablename__ = "documents"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size_bytes: Mapped[int] = mapped_column(default=0)

    category: Mapped[str] = mapped_column(String(50), default="unclassified")
    # receipt | quotation | customer_document | pricing | other

    extracted_text: Mapped[str] = mapped_column(Text, default="")
    extracted_fields_json: Mapped[str] = mapped_column(Text, default="{}")
    extraction_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    needs_review: Mapped[bool] = mapped_column(default=False)

    customer_id: Mapped[str] = mapped_column(ForeignKey("customers.id"), nullable=True, index=True)

    uploaded_by: Mapped[str] = mapped_column(String(50), default="user")
