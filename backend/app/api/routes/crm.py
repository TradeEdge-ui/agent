from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.crm import Contact, Customer, Interaction, Lead
from app.schemas.crm import (
    ContactCreate,
    ContactOut,
    CustomerCreate,
    CustomerOut,
    CustomerUpdate,
    InteractionCreate,
    InteractionOut,
    LeadCreate,
    LeadOut,
    LeadUpdate,
)
from app.services.audit_service import write_audit_log

router = APIRouter(prefix="/api", tags=["crm"])


# ---------- Customers ----------
@router.get("/customers", response_model=list[CustomerOut])
def list_customers(q: str | None = None, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    query = db.query(Customer).filter(Customer.business_id == ctx.business.id)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Customer.name.ilike(like), Customer.email.ilike(like), Customer.company.ilike(like)))
    return query.order_by(Customer.created_at.desc()).all()


@router.post("/customers", response_model=CustomerOut, status_code=201)
def create_customer(payload: CustomerCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    customer = Customer(business_id=ctx.business.id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Created customer {customer.name}", output_summary=customer.id,
    )
    return customer


@router.get("/customers/{customer_id}", response_model=CustomerOut)
def get_customer(customer_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.business_id == ctx.business.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: str, payload: CustomerUpdate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.business_id == ctx.business.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}", status_code=204)
def delete_customer(customer_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.business_id == ctx.business.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(customer)
    db.commit()
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Deleted customer {customer_id}",
    )


# ---------- Contacts ----------
@router.post("/contacts", response_model=ContactOut, status_code=201)
def create_contact(payload: ContactCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id, Customer.business_id == ctx.business.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    contact = Contact(business_id=ctx.business.id, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/customers/{customer_id}/contacts", response_model=list[ContactOut])
def list_contacts(customer_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    return db.query(Contact).filter(Contact.customer_id == customer_id, Contact.business_id == ctx.business.id).all()


# ---------- Leads ----------
@router.get("/leads", response_model=list[LeadOut])
def list_leads(status: str | None = None, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    query = db.query(Lead).filter(Lead.business_id == ctx.business.id)
    if status:
        query = query.filter(Lead.status == status)
    return query.order_by(Lead.created_at.desc()).all()


@router.post("/leads", response_model=LeadOut, status_code=201)
def create_lead(payload: LeadCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    data = payload.model_dump()
    lead = Lead(business_id=ctx.business.id, last_activity_at=datetime.now(timezone.utc), **data)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    write_audit_log(
        db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
        action=f"Created lead {lead.title}", output_summary=lead.id,
    )
    return lead


@router.get("/leads/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.business_id == ctx.business.id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.patch("/leads/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: str, payload: LeadUpdate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter(Lead.id == lead_id, Lead.business_id == ctx.business.id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    data = payload.model_dump(exclude_unset=True)
    status_changed = "status" in data and data["status"] != lead.status
    for field, value in data.items():
        setattr(lead, field, value)
    lead.last_activity_at = datetime.now(timezone.utc)
    db.add(lead)
    db.commit()
    db.refresh(lead)
    if status_changed:
        write_audit_log(
            db, business_id=ctx.business.id, user_id=ctx.member.user_id, actor="user",
            action=f"Lead {lead.title} moved to {lead.status}",
        )
    return lead


# ---------- Interactions ----------
@router.post("/interactions", response_model=InteractionOut, status_code=201)
def create_interaction(payload: InteractionCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    interaction = Interaction(business_id=ctx.business.id, created_by="user", **payload.model_dump())
    db.add(interaction)
    if payload.lead_id:
        lead = db.get(Lead, payload.lead_id)
        if lead and lead.business_id == ctx.business.id:
            lead.last_activity_at = datetime.now(timezone.utc)
            db.add(lead)
    db.commit()
    db.refresh(interaction)
    return interaction


@router.get("/leads/{lead_id}/interactions", response_model=list[InteractionOut])
def list_lead_interactions(lead_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    return (
        db.query(Interaction)
        .filter(Interaction.lead_id == lead_id, Interaction.business_id == ctx.business.id)
        .order_by(Interaction.created_at.desc())
        .all()
    )
