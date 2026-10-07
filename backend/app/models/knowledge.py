from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin, UUIDMixin


class KnowledgeDocument(Base, UUIDMixin, TimestampMixin):
    """A business knowledge source: SOPs, pricing sheets, FAQs, policies, etc."""

    __tablename__ = "knowledge_documents"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="upload")  # upload | manual
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id"), nullable=True)
    raw_text: Mapped[str] = mapped_column(Text, default="")

    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base, UUIDMixin, TimestampMixin):
    """A retrievable slice of a KnowledgeDocument.

    MVP retrieval is simple keyword/term-frequency scoring over chunks
    (see app/services/knowledge_service.py). The schema is intentionally
    vector-store-ready: swapping in embeddings later only touches that
    service, not this table shape.
    """

    __tablename__ = "knowledge_chunks"

    business_id: Mapped[str] = mapped_column(ForeignKey("businesses.id"), nullable=False, index=True)
    document_id: Mapped[str] = mapped_column(ForeignKey("knowledge_documents.id"), nullable=False, index=True)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    document = relationship("KnowledgeDocument", back_populates="chunks")
