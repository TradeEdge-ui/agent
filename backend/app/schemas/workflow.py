from datetime import datetime

from pydantic import BaseModel, Field


class WorkflowStepIn(BaseModel):
    step_type: str = "TOOL_CALL"  # TOOL_CALL | CONDITION
    tool_name: str = ""
    tool_input: dict = Field(default_factory=dict)
    condition_field: str = ""
    condition_operator: str = "eq"  # eq|ne|gt|lt|contains|exists
    condition_value: str = ""
    on_false: str = "stop"  # stop | skip_next


class WorkflowStepOut(BaseModel):
    id: str
    order: int
    step_type: str
    tool_name: str
    tool_input: dict
    condition_field: str
    condition_operator: str
    condition_value: str
    on_false: str


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    trigger_type: str = "MANUAL"  # MANUAL | CRON
    cron_expression: str = ""
    enabled: bool = True
    steps: list[WorkflowStepIn] = Field(default_factory=list)


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    trigger_type: str | None = None
    cron_expression: str | None = None
    enabled: bool | None = None
    steps: list[WorkflowStepIn] | None = None


class WorkflowOut(BaseModel):
    id: str
    name: str
    description: str
    trigger_type: str
    cron_expression: str
    enabled: bool
    created_by: str
    steps: list[WorkflowStepOut]
    created_at: datetime
    updated_at: datetime


class WorkflowRunOut(BaseModel):
    id: str
    workflow_id: str
    status: str
    triggered_by: str
    step_results: list[dict]
    error: str
    started_at: datetime
    completed_at: datetime | None
    created_at: datetime
