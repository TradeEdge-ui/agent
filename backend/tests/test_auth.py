def test_register_and_login(client):
    resp = client.post(
        "/api/auth/register",
        json={"email": "a@b.com", "password": "password123", "full_name": "A B", "business_name": "Biz"},
    )
    assert resp.status_code == 200
    assert "access_token" in resp.json()

    resp2 = client.post("/api/auth/login", json={"email": "a@b.com", "password": "password123"})
    assert resp2.status_code == 200

    resp3 = client.post("/api/auth/login", json={"email": "a@b.com", "password": "wrong"})
    assert resp3.status_code == 401


def test_duplicate_registration_rejected(client):
    payload = {"email": "dup@b.com", "password": "password123", "full_name": "A", "business_name": "Biz"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    assert client.post("/api/auth/register", json=payload).status_code == 409


def test_protected_route_requires_token(client):
    resp = client.get("/api/customers")
    assert resp.status_code == 401


def test_me_returns_business_context(client, auth_headers):
    resp = client.get("/api/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "OWNER"
    assert data["business_name"] == "Test Business"
