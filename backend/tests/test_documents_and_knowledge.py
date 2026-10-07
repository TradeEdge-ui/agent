import io

from app.services.document_service import classify_and_extract
from app.services.knowledge_service import chunk_text


def test_classify_and_extract_receipt_text():
    text = "Acme Cafe\nReceipt\nDate: 2025-05-01\nTotal: RM45.00\nRef: R-1029"
    result = classify_and_extract(text)
    assert result["category"] == "receipt"
    assert result["fields"]["total_amount"]["value"] == 45.0
    assert result["fields"]["reference_number"]["value"].upper().startswith("R-1029") or "1029" in result["fields"]["reference_number"]["value"]


def test_classify_and_extract_empty_text_needs_review():
    result = classify_and_extract("")
    assert result["needs_review"] is True
    assert result["confidence"] == 0.0


def test_document_upload_via_api(client, auth_headers):
    file_content = b"Customer Receipt\nMerchant: Acme Studio\nDate: 2025-06-01\nTotal: USD 120.00\n"
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("receipt.txt", io.BytesIO(file_content), "text/plain")},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["category"] in ("receipt", "other", "unclassified")
    assert "total_amount" in data["extracted_fields"] or data["needs_review"] is True


def test_rejects_unsupported_file_type(client, auth_headers):
    resp = client.post(
        "/api/documents/upload",
        files={"file": ("virus.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_knowledge_chunking_and_search(client, auth_headers):
    text = (
        "Deposit Policy\n\nOur standard deposit for all new projects is 50% upfront.\n\n"
        "Quotation Validity\n\nAll quotations are valid for 7 days unless stated otherwise."
    )
    resp = client.post("/api/knowledge", json={"title": "Policies", "raw_text": text}, headers=auth_headers)
    assert resp.status_code == 201

    search_resp = client.get("/api/knowledge/search", params={"q": "deposit percentage"}, headers=auth_headers)
    assert search_resp.status_code == 200
    results = search_resp.json()
    assert len(results) > 0
    assert "deposit" in results[0]["chunk_content"].lower()


def test_knowledge_search_no_match_returns_empty(client, auth_headers):
    client.post("/api/knowledge", json={"title": "Doc", "raw_text": "Some unrelated content about scheduling."}, headers=auth_headers)
    resp = client.get("/api/knowledge/search", params={"q": "zzzznonexistentterm"}, headers=auth_headers)
    assert resp.json() == []


def test_chunk_text_splits_paragraphs():
    text = "A" * 300 + "\n\n" + "B" * 300 + "\n\n" + "C" * 300
    chunks = chunk_text(text, chunk_size=400)
    assert len(chunks) >= 2
    assert all(len(c) <= 700 for c in chunks)  # allows for paragraph combination up to chunk_size
