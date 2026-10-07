def test_audit_log_records_customer_creation(client, auth_headers):
    client.post("/api/customers", json={"name": "Sarah Lim"}, headers=auth_headers)
    resp = client.get("/api/audit", headers=auth_headers)
    actions = [a["action"] for a in resp.json()]
    assert any("Sarah Lim" in a for a in actions)


def test_approval_lifecycle_via_service(client, auth_headers, test_engine, registered_user):
    from sqlalchemy.orm import sessionmaker

    from app.services.approval_service import create_approval

    Session = sessionmaker(bind=test_engine)
    db = Session()
    approval = create_approval(
        db, business_id=registered_user["business_id"], run_id=None, action="Send message",
        reason="Customer asked for a status update", data={"customer_id": "abc"},
        expected_result="A message is recorded", risk_level="HIGH",
    )
    db.close()

    resp = client.get("/api/approvals", headers=auth_headers)
    assert any(a["id"] == approval.id for a in resp.json())

    approve_resp = client.post(f"/api/approvals/{approval.id}/approve", json={"notes": "Looks good"}, headers=auth_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    # Cannot decide twice
    again = client.post(f"/api/approvals/{approval.id}/reject", json={"notes": "late"}, headers=auth_headers)
    assert again.status_code == 400


def test_approval_rejection(client, auth_headers, test_engine, registered_user):
    from sqlalchemy.orm import sessionmaker

    from app.services.approval_service import create_approval

    Session = sessionmaker(bind=test_engine)
    db = Session()
    approval = create_approval(
        db, business_id=registered_user["business_id"], run_id=None, action="Delete record",
        reason="cleanup", data={}, expected_result="record removed", risk_level="HIGH",
    )
    db.close()

    resp = client.post(f"/api/approvals/{approval.id}/reject", json={"notes": "not now"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "REJECTED"
