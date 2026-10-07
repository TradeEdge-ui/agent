def test_create_and_search_customer(client, auth_headers):
    resp = client.post("/api/customers", json={"name": "Sarah Lim", "email": "sarah@x.com"}, headers=auth_headers)
    assert resp.status_code == 201
    customer_id = resp.json()["id"]

    resp = client.get("/api/customers?q=Sarah", headers=auth_headers)
    assert resp.status_code == 200
    assert any(c["id"] == customer_id for c in resp.json())


def test_customer_not_visible_to_other_business(client, auth_headers):
    resp = client.post("/api/customers", json={"name": "Private Co"}, headers=auth_headers)
    customer_id = resp.json()["id"]

    other = client.post(
        "/api/auth/register",
        json={"email": "other@x.com", "password": "password123", "full_name": "Other", "business_name": "Other Biz"},
    )
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}

    resp = client.get(f"/api/customers/{customer_id}", headers=other_headers)
    assert resp.status_code == 404


def test_lead_pipeline_transition(client, auth_headers):
    customer_id = client.post("/api/customers", json={"name": "Daniel Wong"}, headers=auth_headers).json()["id"]
    lead = client.post(
        "/api/leads", json={"title": "Website project", "customer_id": customer_id, "value": 2000}, headers=auth_headers
    ).json()
    assert lead["status"] == "NEW"

    updated = client.patch(f"/api/leads/{lead['id']}", json={"status": "QUALIFIED"}, headers=auth_headers).json()
    assert updated["status"] == "QUALIFIED"


def test_task_create_complete_reopen(client, auth_headers):
    task = client.post("/api/tasks", json={"title": "Follow up"}, headers=auth_headers).json()
    assert task["status"] == "OPEN"

    done = client.post(f"/api/tasks/{task['id']}/complete", headers=auth_headers).json()
    assert done["status"] == "DONE"
    assert done["completed_at"] is not None

    reopened = client.post(f"/api/tasks/{task['id']}/reopen", headers=auth_headers).json()
    assert reopened["status"] == "OPEN"
    assert reopened["completed_at"] is None


def test_overdue_task_detection(client, auth_headers):
    from datetime import datetime, timedelta, timezone

    past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    client.post("/api/tasks", json={"title": "Overdue task", "due_date": past}, headers=auth_headers)
    client.post("/api/tasks", json={"title": "Future task", "due_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()}, headers=auth_headers)

    resp = client.get("/api/tasks?overdue_only=true", headers=auth_headers)
    titles = [t["title"] for t in resp.json()]
    assert "Overdue task" in titles
    assert "Future task" not in titles


def test_follow_up_creation_and_completion(client, auth_headers):
    from datetime import datetime, timedelta, timezone

    customer_id = client.post("/api/customers", json={"name": "Alex Tan"}, headers=auth_headers).json()["id"]
    now = datetime.now(timezone.utc)
    follow_up = client.post(
        "/api/follow-ups",
        json={
            "customer_id": customer_id,
            "trigger_at": now.isoformat(),
            "due_at": (now + timedelta(days=3)).isoformat(),
            "reason": "Check in after quote",
        },
        headers=auth_headers,
    ).json()
    assert follow_up["status"] == "PENDING"

    completed = client.post(
        f"/api/follow-ups/{follow_up['id']}/complete", json={"outcome": "Customer replied"}, headers=auth_headers
    ).json()
    assert completed["status"] == "DONE"
    assert completed["outcome"] == "Customer replied"
