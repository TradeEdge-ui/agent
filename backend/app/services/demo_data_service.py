"""Populates realistic (fictional) sample data into an EXISTING business.

Shared by the onboarding "load demo data" button and the standalone CLI
seed script (scripts/seed_demo_data.py), so there is exactly one definition
of what the sample dataset looks like.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.crm import Customer, Interaction, Lead
from app.models.knowledge import KnowledgeDocument
from app.models.tasks import FollowUp, Task
from app.services import finance_service, knowledge_service
from app.services.business_rule_service import upsert_rule


def now():
    return datetime.now(timezone.utc)


def populate_demo_data(db: Session, business: Business) -> dict:
    upsert_rule(db, business.id, kind="RULE", key="default_deposit_percent", value="50",
                description="Standard deposit required before starting any project.", source="user")
    upsert_rule(db, business.id, kind="RULE", key="quotation_validity_days", value="7",
                description="Standard quotation validity period.", source="user")
    upsert_rule(db, business.id, kind="FACT", key="basic_website_price", value="1500",
                description="Typical price for a simple 5-page brochure website.", source="user")

    kdoc = KnowledgeDocument(
        business_id=business.id, title="Service Pricing & Policies", source_type="manual",
        raw_text=(
            "Service Pricing\n\n"
            "Basic website (up to 5 pages): RM1,500. Delivery in 3-4 weeks.\n"
            "E-commerce website: starting at RM4,000. Delivery in 6-8 weeks.\n"
            "Social media management package: RM800/month, includes 12 posts.\n"
            "Business consultation session: RM200/hour.\n\n"
            "Deposit Policy\n\n"
            "All new projects require a 50% deposit before work begins. The remaining "
            "balance is due on delivery.\n\n"
            "Quotation Validity\n\n"
            "All quotations are valid for 7 days from the issue date unless otherwise stated.\n\n"
            "Lead Qualification\n\n"
            "When a lead becomes QUALIFIED, create a requirements-gathering task before "
            "preparing any quotation."
        ),
    )
    db.add(kdoc)
    db.flush()
    knowledge_service.index_document(db, kdoc)

    alex = Customer(business_id=business.id, name="Alex Tan", email="alex.tan@example.com",
                     phone="+60 12-111 2222", company="Tan Hardware Sdn Bhd", status="ACTIVE", source="Referral")
    sarah = Customer(business_id=business.id, name="Sarah Lim", email="sarah.lim@example.com",
                      phone="+60 12-333 4444", company="Lim Bakery", status="ACTIVE", source="Website")
    daniel = Customer(business_id=business.id, name="Daniel Wong", email="daniel.wong@example.com",
                       phone="+60 12-555 6666", company="Wong Consulting", status="ACTIVE", source="Instagram")
    db.add_all([alex, sarah, daniel])
    db.flush()

    lead_website = Lead(
        business_id=business.id, customer_id=sarah.id, title="Bakery website redesign",
        value=1500.0, source="Website", status="QUALIFIED",
        notes="Wants a simple brochure site with an online order form.",
        next_follow_up=now() + timedelta(days=3), last_activity_at=now() - timedelta(days=1),
    )
    lead_social = Lead(
        business_id=business.id, customer_id=daniel.id, title="Social media package",
        value=800.0, source="Instagram", status="NEW",
        notes="Interested in monthly content package.",
        last_activity_at=now() - timedelta(days=6),
    )
    lead_consult = Lead(
        business_id=business.id, customer_id=alex.id, title="Business consultation",
        value=400.0, source="Referral", status="NEGOTIATING",
        notes="Wants a 2-hour strategy session.",
        next_follow_up=now() - timedelta(days=1), last_activity_at=now() - timedelta(days=8),
    )
    db.add_all([lead_website, lead_social, lead_consult])
    db.flush()

    db.add(Interaction(
        business_id=business.id, customer_id=sarah.id, lead_id=lead_website.id, channel="message",
        direction="inbound", created_by="user",
        content="Hi, I need help creating a simple website for my bakery. Budget is around RM1,500 "
                "and I'd like it done next month.",
    ))

    db.add(Task(business_id=business.id, title="Gather requirements for bakery website",
                description="Confirm page list, branding assets, and order-form fields.",
                priority="HIGH", status="OPEN", customer_id=sarah.id, lead_id=lead_website.id,
                created_by="user", due_date=now() + timedelta(days=2)))
    db.add(Task(business_id=business.id, title="Follow up with Daniel on social package",
                priority="MEDIUM", status="OPEN", customer_id=daniel.id, lead_id=lead_social.id,
                created_by="user", due_date=now() - timedelta(days=1)))
    db.add(Task(business_id=business.id, title="Customer onboarding checklist - Alex Tan",
                priority="LOW", status="OPEN", customer_id=alex.id, created_by="user"))
    db.flush()

    db.add(FollowUp(business_id=business.id, customer_id=daniel.id, lead_id=lead_social.id,
                     trigger_at=now() - timedelta(days=6), due_at=now() - timedelta(days=1),
                     reason="No reply after initial Instagram DM.", status="PENDING", created_by="user"))

    quote = finance_service.create_quotation(
        db, business, customer_id=sarah.id, lead_id=lead_website.id,
        items=[{"description": "Basic brochure website (up to 5 pages)", "quantity": 1, "unit_price": 1500.0}],
        notes="Includes responsive design and a contact/order form.",
        payment_terms="50% deposit, balance on delivery", created_by="user",
    )
    quote.status = "PENDING_APPROVAL"
    db.add(quote)

    finance_service.create_invoice(
        db, business, customer_id=alex.id, quotation_id=None,
        items=[{"description": "Business consultation (2 hours)", "quantity": 2, "unit_price": 200.0}],
        notes="Draft invoice pending project confirmation.", created_by="user",
    )

    db.commit()
    return {"customers": 3, "leads": 3, "tasks": 3, "quotations": 1, "invoices": 1, "knowledge_documents": 1}
