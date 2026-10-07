from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.approval import Approval
from app.models.business import Business
from app.services.approval_service import approval_to_dict, create_approval
from app.tools.registry import tool


class ListPendingApprovalsInput(BaseModel):
    pass


@tool("list_pending_approvals", "List approval requests currently waiting for a decision.", ListPendingApprovalsInput)
def list_pending_approvals(db: Session, business: Business, user_id: str, params: ListPendingApprovalsInput) -> dict:
    approvals = (
        db.query(Approval)
        .filter(Approval.business_id == business.id, Approval.status == "PENDING")
        .order_by(Approval.created_at.desc())
        .all()
    )
    return {"approvals": [approval_to_dict(a) for a in approvals]}


class CreateApprovalRequestInput(BaseModel):
    action: str
    reason: str
    expected_result: str
    risk_level: str = "MEDIUM"
    data: dict = {}


@tool(
    "create_approval_request", "Explicitly file a request for the business owner to review and decide on "
    "an action that doesn't map to another tool (e.g. a free-form recommendation). Use this instead of "
    "performing an action you are not confident about.", CreateApprovalRequestInput, risk="LOW", write=True,
)
def create_approval_request_tool(db: Session, business: Business, user_id: str, params: CreateApprovalRequestInput) -> dict:
    approval = create_approval(
        db, business_id=business.id, run_id=None, action=params.action, reason=params.reason,
        data=params.data, expected_result=params.expected_result, risk_level=params.risk_level,
    )
    return {"id": approval.id, "created": True}
