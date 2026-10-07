"""Central place every meaningful action is logged through.

Any service that mutates data on the agent's behalf (or performs a
sensitive user action) should call `write_audit_log` so the Activity page
has a complete, truthful record. Never skip this for an AI-initiated change.
"""
from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def write_audit_log(
    db: Session,
    *,
    business_id: str,
    user_id: str | None = None,
    run_id: str | None = None,
    actor: str = "user",
    action: str,
    tool_name: str = "",
    input_summary: str = "",
    output_summary: str = "",
    approval_required: bool = False,
    approval_result: str = "",
    success: bool = True,
    error: str = "",
) -> AuditLog:
    entry = AuditLog(
        business_id=business_id,
        user_id=user_id,
        run_id=run_id,
        actor=actor,
        action=action,
        tool_name=tool_name,
        input_summary=input_summary[:2000],
        output_summary=output_summary[:2000],
        approval_required=approval_required,
        approval_result=approval_result,
        success=success,
        error=error[:2000],
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
