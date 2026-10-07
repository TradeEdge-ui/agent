from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.business import Business
from app.services import business_rule_service, knowledge_service
from app.tools.registry import tool


class SearchKnowledgeBaseInput(BaseModel):
    query: str


@tool(
    "search_knowledge_base", "Search the business's uploaded knowledge documents (SOPs, pricing, FAQs, "
    "policies) for relevant passages. Always cite this instead of guessing business facts.",
    SearchKnowledgeBaseInput,
)
def search_knowledge_base(db: Session, business: Business, user_id: str, params: SearchKnowledgeBaseInput) -> dict:
    results = knowledge_service.search(db, business.id, params.query)
    if not results:
        return {"results": [], "note": "No matching knowledge found. Do not guess; tell the user this is unknown."}
    return {"results": results}


class RetrieveBusinessRuleInput(BaseModel):
    key: str


@tool(
    "retrieve_business_rule", "Retrieve a confirmed structured business rule by key (e.g. "
    "'default_deposit_percent', 'quotation_validity_days'). Returns not_found if no confirmed rule exists "
    "-- never invent a business rule value.", RetrieveBusinessRuleInput,
)
def retrieve_business_rule(db: Session, business: Business, user_id: str, params: RetrieveBusinessRuleInput) -> dict:
    rule = business_rule_service.get_rule(db, business.id, params.key)
    if not rule:
        return {"found": False, "key": params.key}
    return {"found": True, "key": rule.key, "value": rule.value, "kind": rule.kind}
