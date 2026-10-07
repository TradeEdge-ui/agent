from pydantic import BaseModel


class RecommendationOut(BaseModel):
    text: str
    reason: str
    priority: str  # LOW|MEDIUM|HIGH
    link: str = ""


class DashboardOut(BaseModel):
    urgent_tasks: list[dict]
    new_leads: list[dict]
    leads_needing_follow_up: list[dict]
    quotations_awaiting_approval: list[dict]
    overdue_tasks: list[dict]
    invoice_alerts: list[dict]
    recent_activity: list[dict]
    recommendations: list[RecommendationOut]


class DailyBriefOut(BaseModel):
    generated_at: str
    urgent_tasks_count: int
    new_leads_count: int
    overdue_follow_ups_count: int
    pending_quotations_count: int
    important_invoices_count: int
    summary_text: str
    recommendations: list[RecommendationOut]
