from app.api.deps import ROLE_RANK
from app.models.business import BusinessMember


def test_role_rank_ordering():
    assert ROLE_RANK["USER"] < ROLE_RANK["ADMIN"] < ROLE_RANK["OWNER"]


def test_non_admin_cannot_update_business(client, registered_user, test_engine):
    from sqlalchemy.orm import sessionmaker

    Session = sessionmaker(bind=test_engine)
    db = Session()
    member = db.query(BusinessMember).filter(BusinessMember.user_id == registered_user["user_id"]).first()
    member.role = "USER"
    db.add(member)
    db.commit()
    db.close()

    resp = client.patch("/api/business", json={"name": "New Name"}, headers=registered_user["headers"])
    assert resp.status_code == 403


def test_owner_can_update_business(client, auth_headers):
    resp = client.patch("/api/business", json={"name": "Renamed Biz"}, headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed Biz"


def test_business_scoped_header_rejected_for_non_member(client, auth_headers):
    resp = client.get("/api/customers", headers={**auth_headers, "X-Business-Id": "nonexistent-id"})
    assert resp.status_code == 403
