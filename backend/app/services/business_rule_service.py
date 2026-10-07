"""Business memory: facts, preferences, rules, assumptions.

`confirmed=False` rules are agent-suggested and must not be treated as
settled truth until a human confirms them -- this is what stops the agent
from silently rewriting an important business rule off the back of an
ordinary chat message (spec section 22/32).
"""
from sqlalchemy.orm import Session

from app.models.business_rule import BusinessRule

IMPORTANT_KINDS = {"RULE"}


def upsert_rule(
    db: Session, business_id: str, *, kind: str, key: str, value: str,
    description: str = "", source: str = "user", confirmed: bool | None = None,
) -> BusinessRule:
    existing = (
        db.query(BusinessRule)
        .filter(BusinessRule.business_id == business_id, BusinessRule.key == key)
        .first()
    )
    if confirmed is None:
        confirmed = source == "user"

    if existing:
        if existing.confirmed and source == "agent_suggested":
            # An agent may never silently overwrite an already-confirmed rule.
            # It must create a separate unconfirmed suggestion instead.
            key = f"{key}__suggested"
            existing = None

    if existing:
        existing.value = value
        existing.description = description or existing.description
        existing.source = source
        existing.confirmed = confirmed
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    rule = BusinessRule(
        business_id=business_id, kind=kind, key=key, value=value,
        description=description, source=source, confirmed=confirmed,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


def list_rules(db: Session, business_id: str) -> list[BusinessRule]:
    return db.query(BusinessRule).filter(BusinessRule.business_id == business_id).all()


def get_rule(db: Session, business_id: str, key: str) -> BusinessRule | None:
    return (
        db.query(BusinessRule)
        .filter(BusinessRule.business_id == business_id, BusinessRule.key == key, BusinessRule.confirmed.is_(True))
        .first()
    )
