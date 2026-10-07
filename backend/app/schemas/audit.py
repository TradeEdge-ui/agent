from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: str
    actor: str
    action: str
    tool_name: str
    input_summary: str
    output_summary: str
    approval_required: bool
    approval_result: str
    success: bool
    error: str
    created_at: datetime

    class Config:
        from_attributes = True
