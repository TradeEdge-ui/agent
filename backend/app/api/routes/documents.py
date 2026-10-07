import json
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.core.config import get_settings
from app.database.session import get_db
from app.models.documents import Document
from app.models.knowledge import KnowledgeDocument
from app.schemas.documents import (
    DocumentOut,
    KnowledgeDocumentCreate,
    KnowledgeDocumentOut,
    KnowledgeSearchResult,
)
from app.services import document_service, knowledge_service
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/api", tags=["documents"])
settings = get_settings()


def _document_out(doc: Document) -> dict:
    return {
        "id": doc.id, "filename": doc.filename, "content_type": doc.content_type,
        "size_bytes": doc.size_bytes, "category": doc.category,
        "extracted_fields": json.loads(doc.extracted_fields_json or "{}"),
        "extraction_confidence": doc.extraction_confidence, "needs_review": doc.needs_review,
        "customer_id": doc.customer_id, "uploaded_by": doc.uploaded_by, "created_at": doc.created_at,
    }


@router.post("/documents/upload", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    customer_id: str | None = None,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "upload").suffix.lower()
    if ext not in document_service.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    upload_dir = Path(settings.UPLOAD_DIR) / ctx.business.id
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = upload_dir / safe_name
    storage_path.write_bytes(contents)

    text, extractable = document_service.extract_text(str(storage_path), file.content_type or "")
    extraction = document_service.classify_and_extract(text) if extractable else {
        "category": "unclassified", "fields": {}, "confidence": 0.0, "needs_review": True,
    }

    doc = Document(
        business_id=ctx.business.id,
        filename=file.filename or safe_name,
        storage_path=str(storage_path),
        content_type=file.content_type or "",
        size_bytes=len(contents),
        category=extraction["category"],
        extracted_text=text[:20000],
        extracted_fields_json=document_service.fields_to_json(extraction["fields"]),
        extraction_confidence=extraction["confidence"],
        needs_review=extraction["needs_review"],
        customer_id=customer_id,
        uploaded_by="user",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Uploaded document {doc.filename}",
        output_summary=f"category={doc.category} confidence={doc.extraction_confidence}",
    )
    return _document_out(doc)


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    docs = db.query(Document).filter(Document.business_id == ctx.business.id).order_by(Document.created_at.desc()).all()
    return [_document_out(d) for d in docs]


@router.get("/documents/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id, Document.business_id == ctx.business.id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _document_out(doc)


# ---------- Knowledge base ----------
@router.post("/knowledge", response_model=KnowledgeDocumentOut, status_code=201)
def create_knowledge_document(
    payload: KnowledgeDocumentCreate,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    kdoc = KnowledgeDocument(
        business_id=ctx.business.id, title=payload.title, source_type="manual", raw_text=payload.raw_text,
    )
    db.add(kdoc)
    db.commit()
    db.refresh(kdoc)
    knowledge_service.index_document(db, kdoc)
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Added knowledge document '{kdoc.title}'",
    )
    return kdoc


@router.post("/knowledge/upload", response_model=KnowledgeDocumentOut, status_code=201)
async def upload_knowledge_document(
    file: UploadFile,
    ctx: BusinessContext = Depends(get_current_business),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "upload").suffix.lower()
    if ext not in document_service.ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")
    contents = await file.read()

    upload_dir = Path(settings.UPLOAD_DIR) / ctx.business.id
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid.uuid4().hex}{ext}"
    storage_path = upload_dir / safe_name
    storage_path.write_bytes(contents)

    text, extractable = document_service.extract_text(str(storage_path), file.content_type or "")
    if not extractable:
        raise HTTPException(status_code=400, detail="Could not extract text from this file")

    doc = Document(
        business_id=ctx.business.id, filename=file.filename or safe_name, storage_path=str(storage_path),
        content_type=file.content_type or "", size_bytes=len(contents), category="pricing",
        extracted_text=text[:20000], uploaded_by="user",
    )
    db.add(doc)
    db.flush()

    kdoc = KnowledgeDocument(
        business_id=ctx.business.id, title=file.filename or safe_name, source_type="upload",
        document_id=doc.id, raw_text=text,
    )
    db.add(kdoc)
    db.commit()
    db.refresh(kdoc)
    knowledge_service.index_document(db, kdoc)
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Indexed knowledge document '{kdoc.title}'",
    )
    return kdoc


@router.get("/knowledge", response_model=list[KnowledgeDocumentOut])
def list_knowledge_documents(ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    return (
        db.query(KnowledgeDocument)
        .filter(KnowledgeDocument.business_id == ctx.business.id)
        .order_by(KnowledgeDocument.created_at.desc())
        .all()
    )


@router.delete("/knowledge/{document_id}", status_code=204)
def delete_knowledge_document(document_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    kdoc = db.query(KnowledgeDocument).filter(KnowledgeDocument.id == document_id, KnowledgeDocument.business_id == ctx.business.id).first()
    if not kdoc:
        raise HTTPException(status_code=404, detail="Knowledge document not found")
    db.delete(kdoc)
    db.commit()


@router.get("/knowledge/search", response_model=list[KnowledgeSearchResult])
def search_knowledge(q: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    return knowledge_service.search(db, ctx.business.id, q)
