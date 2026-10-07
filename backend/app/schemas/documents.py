from datetime import datetime

from pydantic import BaseModel


class DocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str
    size_bytes: int
    category: str
    extracted_fields: dict
    extraction_confidence: float
    needs_review: bool
    customer_id: str | None
    uploaded_by: str
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeDocumentCreate(BaseModel):
    title: str
    raw_text: str


class KnowledgeDocumentOut(BaseModel):
    id: str
    title: str
    source_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeSearchResult(BaseModel):
    document_id: str
    document_title: str
    chunk_content: str
    score: float
