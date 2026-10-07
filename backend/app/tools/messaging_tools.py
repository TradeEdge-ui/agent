from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.crm import Interaction, Lead
from app.tools.registry import ToolError, tool


class SendCustomerMessageInput(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    message: str


@tool(
    "send_customer_message", "Record and (in a future integration) deliver an outbound message to a "
    "customer. This is an external, customer-facing action and always requires explicit human approval. "
    "No real email/SMS provider is connected in this MVP -- the message is recorded, never actually "
    "transmitted, and the tool result says so honestly.", SendCustomerMessageInput, risk="HIGH", write=True,
)
def send_customer_message(db: Session, business: Business, user_id: str, params: SendCustomerMessageInput) -> dict:
    if not params.customer_id and not params.lead_id:
        raise ToolError("A message must target a customer or a lead")
    interaction = Interaction(
        business_id=business.id, customer_id=params.customer_id, lead_id=params.lead_id,
        channel="message", direction="outbound", content=params.message, created_by="agent",
    )
    db.add(interaction)
    if params.lead_id:
        lead = db.get(Lead, params.lead_id)
        if lead and lead.business_id == business.id:
            from datetime import datetime, timezone
            lead.last_activity_at = datetime.now(timezone.utc)
            db.add(lead)
    db.commit()
    db.refresh(interaction)
    return {
        "id": interaction.id,
        "recorded": True,
        "actually_sent": False,
        "note": "No external messaging provider is connected. The message was recorded as an outbound "
        "interaction only; it was not transmitted to the customer.",
    }
