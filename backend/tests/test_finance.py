from app.services.finance_service import compute_line_total, compute_totals


def test_line_total_with_discount():
    assert compute_line_total(2, 100.0, 10) == 180.0  # 2*100 - 10%


def test_compute_totals_with_tax_and_discount():
    items = [{"quantity": 1, "unit_price": 1500.0, "discount_percent": 0}]
    subtotal, tax_amount, total = compute_totals(items, header_discount_percent=10, tax_percent=6)
    assert subtotal == 1500.0
    # after 10% discount -> 1350, tax 6% of 1350 = 81
    assert tax_amount == 81.0
    assert total == 1431.0


def test_create_quote_via_api_calculates_total(client, auth_headers):
    customer_id = client.post("/api/customers", json={"name": "Daniel Wong"}, headers=auth_headers).json()["id"]
    resp = client.post(
        "/api/quotes",
        json={
            "customer_id": customer_id,
            "items": [{"description": "Basic website", "quantity": 1, "unit_price": 1500}],
            "discount_percent": 0,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "DRAFT"
    assert data["total"] == 1500.0
    assert data["number"].startswith("QT-")


def test_quote_status_transition_rules(client, auth_headers):
    customer_id = client.post("/api/customers", json={"name": "Daniel Wong"}, headers=auth_headers).json()["id"]
    quote = client.post(
        "/api/quotes",
        json={"customer_id": customer_id, "items": [{"description": "Item", "quantity": 1, "unit_price": 100}]},
        headers=auth_headers,
    ).json()

    # DRAFT -> ACCEPTED directly is not allowed
    resp = client.patch(f"/api/quotes/{quote['id']}", json={"status": "ACCEPTED"}, headers=auth_headers)
    assert resp.status_code == 400

    resp = client.patch(f"/api/quotes/{quote['id']}", json={"status": "PENDING_APPROVAL"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "PENDING_APPROVAL"


def test_create_invoice_draft_and_pdf(client, auth_headers):
    customer_id = client.post("/api/customers", json={"name": "Alex Tan"}, headers=auth_headers).json()["id"]
    invoice = client.post(
        "/api/invoices",
        json={"customer_id": customer_id, "items": [{"description": "Deposit", "quantity": 1, "unit_price": 750}]},
        headers=auth_headers,
    ).json()
    assert invoice["status"] == "DRAFT"
    assert invoice["total"] == 750.0

    pdf_resp = client.get(f"/api/invoices/{invoice['id']}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"
