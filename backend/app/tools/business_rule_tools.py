from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.business import Business
from app.services import business_rule_service
from app.tools.registry import tool


class ProposeBusinessRuleInput(BaseModel):
    key: str
    value: str
    kind: str = "RULE"
    description: str = ""


@tool(
    "propose_business_rule", "Propose a new or updated business rule/fact learned from conversation. If a "
    "confirmed rule with this key already exists, this creates an unconfirmed suggestion instead of "
    "silently overwriting it -- the owner must explicitly confirm the change.", ProposeBusinessRuleInput,
    risk="LOW", write=True,
)
def propose_business_rule(db: Session, business: Business, user_id: str, params: ProposeBusinessRuleInput) -> dict:
    rule = business_rule_service.upsert_rule(
        db, business.id, kind=params.kind, key=params.key, value=params.value,
        description=params.description, source="agent_suggested",
    )
    return {"id": rule.id, "key": rule.key, "confirmed": rule.confirmed}
