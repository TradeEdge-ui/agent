"""Business knowledge retrieval.

MVP retrieval is a simple, dependency-free TF scoring over chunks -- no
vector DB required, nothing to install, works fully offline. The chunk
schema (KnowledgeChunk) is shaped so a future embedding-based retriever can
replace just this module without touching storage or the agent tool
contract (`search_knowledge_base`).
"""
import re
from collections import Counter

from sqlalchemy.orm import Session

from app.models.knowledge import KnowledgeChunk, KnowledgeDocument

CHUNK_SIZE = 600  # characters
STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "to", "of", "and", "or",
    "in", "on", "for", "with", "this", "that", "it", "our", "we", "you", "your",
}


def _tokenize(text: str) -> list[str]:
    return [w for w in re.findall(r"[a-z0-9']+", text.lower()) if w not in STOPWORDS and len(w) > 1]


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    chunks: list[str] = []
    current = ""
    for p in paragraphs:
        if len(current) + len(p) + 1 <= chunk_size:
            current = f"{current}\n{p}" if current else p
        else:
            if current:
                chunks.append(current)
            current = p
    if current:
        chunks.append(current)
    if not chunks and text.strip():
        # Fallback: hard split for text with no paragraph breaks.
        chunks = [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
    return chunks


def index_document(db: Session, document: KnowledgeDocument) -> None:
    for existing in list(document.chunks):
        db.delete(existing)
    db.flush()
    for idx, chunk in enumerate(chunk_text(document.raw_text)):
        db.add(
            KnowledgeChunk(
                business_id=document.business_id,
                document_id=document.id,
                chunk_index=idx,
                content=chunk,
            )
        )
    db.commit()


def search(db: Session, business_id: str, query: str, top_k: int = 5) -> list[dict]:
    query_terms = Counter(_tokenize(query))
    if not query_terms:
        return []

    chunks = (
        db.query(KnowledgeChunk, KnowledgeDocument)
        .join(KnowledgeDocument, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .filter(KnowledgeChunk.business_id == business_id)
        .all()
    )

    scored = []
    for chunk, doc in chunks:
        chunk_terms = Counter(_tokenize(chunk.content))
        score = sum(count * chunk_terms.get(term, 0) for term, count in query_terms.items())
        if score > 0:
            scored.append((score, chunk, doc))

    scored.sort(key=lambda t: t[0], reverse=True)
    results = []
    for score, chunk, doc in scored[:top_k]:
        results.append(
            {
                "document_id": doc.id,
                "document_title": doc.title,
                "chunk_content": chunk.content,
                "score": float(score),
            }
        )
    return results
