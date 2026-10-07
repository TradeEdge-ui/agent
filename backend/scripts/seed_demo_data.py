"""Loads a realistic (fictional) demo account for local development/evaluation.

Run with:  python -m scripts.seed_demo_data   (from the backend/ directory, venv active)

Safe to re-run: if the demo account already exists, it is reused rather
than duplicated.
"""
from app.database.session import Base, SessionLocal, engine
from app.models.business import Business, BusinessMember
from app.models.user import User
from app.security.passwords import hash_password
from app.services.audit_service import write_audit_log
from app.services.demo_data_service import populate_demo_data

DEMO_EMAIL = "demo@brightpathstudio.com"
DEMO_PASSWORD = "DemoPass123!"


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if user:
            print(f"Demo user {DEMO_EMAIL} already exists -- skipping seed to avoid duplicates.")
            print(f"Login with: {DEMO_EMAIL} / {DEMO_PASSWORD}")
            return

        user = User(email=DEMO_EMAIL, hashed_password=hash_password(DEMO_PASSWORD), full_name="Jamie Demo")
        db.add(user)
        db.flush()

        business = Business(
            name="Bright Path Studio",
            description="A small freelance web design and digital marketing studio.",
            industry="Creative services",
            currency="RM",
            timezone="Asia/Kuala_Lumpur",
            contact_email="hello@brightpathstudio.example",
            contact_phone="+60 12-345 6789",
            address="12 Jalan Maju, 50450 Kuala Lumpur, Malaysia",
            default_quotation_validity_days=7,
            default_payment_terms="50% deposit, balance on delivery",
            tax_label="SST",
            tax_rate_percent=6.0,
            tax_registered=False,
            autonomy_level="DRAFT",
            onboarding_completed=True,
        )
        db.add(business)
        db.flush()
        db.add(BusinessMember(business_id=business.id, user_id=user.id, role="OWNER"))
        db.commit()

        populate_demo_data(db, business)
        write_audit_log(db, business_id=business.id, user_id=user.id, actor="user", action="Seeded demo data")

        print("Demo data created.")
        print(f"Login with: {DEMO_EMAIL} / {DEMO_PASSWORD}")
        print(f"Business: {business.name} ({business.id})")
    finally:
        db.close()


if __name__ == "__main__":
    run()
