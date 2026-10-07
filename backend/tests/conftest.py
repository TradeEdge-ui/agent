import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.session import Base, get_db
from app.main import app
from app import models  # noqa: F401
from app import tools  # noqa: F401


@pytest.fixture()
def test_engine():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(test_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def registered_user(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "owner@example.com",
            "password": "password123",
            "full_name": "Test Owner",
            "business_name": "Test Business",
        },
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/auth/me", headers=headers).json()
    return {"headers": headers, "business_id": me["business_id"], "user_id": me["user"]["id"]}


@pytest.fixture()
def auth_headers(registered_user):
    return registered_user["headers"]
