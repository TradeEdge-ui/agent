import json

from sqlalchemy.orm import Session

from app.models.approval import Approval


def create_approval(
    db: Session,
    *,
    business_id: str,
    run_id: str | None,
    action: str,
    reason: str,
    data: dict,
    expected_result: str,
    risk_level: str,
    tool_name: str = "",
    tool_input: dict | None = None,
) -> Approval:
    approval = Approval(
        business_id=business_id,
        run_id=run_id,
        action=action,
        reason=reason,
        data_json=json.dumps(data),
        expected_result=expected_result,
        risk_level=risk_level,
        tool_name=tool_name,
        tool_input_json=json.dumps(tool_input or {}),
        status="PENDING",
    )
    db.add(approval)
    db.commit()
    db.refresh(approval)
    return approval


def approval_to_dict(approval: Approval) -> dict:
    return {
        "id": approval.id,
        "run_id": approval.run_id,
        "action": approval.action,
        "reason": approval.reason,
        "data": json.loads(approval.data_json or "{}"),
        "expected_result": approval.expected_result,
        "risk_level": approval.risk_level,
        "tool_name": approval.tool_name,
        "tool_input": json.loads(approval.tool_input_json or "{}"),
        "status": approval.status,
        "decided_by": approval.decided_by,
        "decision_notes": approval.decision_notes,
        "edited_input": json.loads(approval.edited_input_json) if approval.edited_input_json else None,
        "created_at": approval.created_at,
    }
