import json

from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.documents import Document
from app.tools.registry import ToolError, tool


class SearchDocumentsInput(BaseModel):
    query: str = ""
    category: str | None = None


@tool("search_documents", "Search uploaded business documents by filename or category.", SearchDocumentsInput)
def search_documents(db: Session, business: Business, user_id: str, params: SearchDocumentsInput) -> dict:
    q = db.query(Document).filter(Document.business_id == business.id)
    if params.category:
        q = q.filter(Document.category == params.category)
    if params.query:
        q = q.filter(or_(Document.filename.ilike(f"%{params.query}%"), Document.extracted_text.ilike(f"%{params.query}%")))
    results = q.order_by(Document.created_at.desc()).limit(20).all()
    return {
        "documents": [
            {"id": d.id, "filename": d.filename, "category": d.category, "needs_review": d.needs_review}
            for d in results
        ]
    }


class ExtractDocumentInformationInput(BaseModel):
    document_id: str


@tool(
    "extract_document_information", "Retrieve the structured fields already extracted from an uploaded "
    "document, each with a confidence score. Fields marked low-confidence must be treated as UNKNOWN, "
    "never as fact.", ExtractDocumentInformationInput,
)
def extract_document_information(db: Session, business: Business, user_id: str, params: ExtractDocumentInformationInput) -> dict:
    doc = db.query(Document).filter(Document.id == params.document_id, Document.business_id == business.id).first()
    if not doc:
        raise ToolError(f"No document found with id {params.document_id}")
    return {
        "id": doc.id, "category": doc.category,
        "fields": json.loads(doc.extracted_fields_json or "{}"),
        "confidence": doc.extraction_confidence, "needs_review": doc.needs_review,
    }
