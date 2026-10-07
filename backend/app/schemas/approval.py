from datetime import datetime

from pydantic import BaseModel


class ApprovalOut(BaseModel):
    id: str
    run_id: str | None
    action: str
    reason: str
    data: dict
    expected_result: str
    risk_level: str
    tool_name: str
    tool_input: dict
    status: str
    decided_by: str
    decision_notes: str
    edited_input: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApprovalDecision(BaseModel):
    notes: str = ""
    edited_input: dict | None = None
