from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.agent import AgentRun
from app.services.dashboard_service import generate_daily_brief, get_dashboard_data
from app.tools.registry import tool


class GetDailySummaryInput(BaseModel):
    pass


@tool("get_daily_summary", "Get today's prioritized business summary: urgent tasks, new leads, overdue follow-ups, pending approvals.", GetDailySummaryInput)
def get_daily_summary(db: Session, business: Business, user_id: str, params: GetDailySummaryInput) -> dict:
    return generate_daily_brief(db, business)


class GetBusinessSummaryInput(BaseModel):
    pass


@tool("get_business_summary", "Get a snapshot of current business activity across customers, leads, tasks, quotes and invoices.", GetBusinessSummaryInput)
def get_business_summary(db: Session, business: Business, user_id: str, params: GetBusinessSummaryInput) -> dict:
    data = get_dashboard_data(db, business)
    return {
        "urgent_task_count": len(data["urgent_tasks"]),
        "new_lead_count": len(data["new_leads"]),
        "stale_lead_count": len(data["leads_needing_follow_up"]),
        "quotations_awaiting_approval": len(data["quotations_awaiting_approval"]),
        "overdue_invoice_count": len(data["invoice_alerts"]),
        "overdue_task_count": len(data["overdue_tasks"]),
    }


class GetAgentHistoryInput(BaseModel):
    limit: int = 10


@tool("get_agent_history", "List recent agent runs for this business with their status and summary.", GetAgentHistoryInput)
def get_agent_history(db: Session, business: Business, user_id: str, params: GetAgentHistoryInput) -> dict:
    runs = (
        db.query(AgentRun)
        .filter(AgentRun.business_id == business.id)
        .order_by(AgentRun.created_at.desc())
        .limit(min(params.limit, 50))
        .all()
    )
    return {
        "runs": [
            {"id": r.id, "request": r.request_text, "status": r.status, "final_response": r.final_response}
            for r in runs
        ]
    }
