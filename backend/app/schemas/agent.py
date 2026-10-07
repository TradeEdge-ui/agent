from datetime import datetime

from pydantic import BaseModel


class AgentRunRequest(BaseModel):
    message: str


class AgentMessageOut(BaseModel):
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ToolExecutionOut(BaseModel):
    tool_name: str
    input: dict
    output: dict
    success: bool
    error: str
    required_approval: bool

    class Config:
        from_attributes = True


class AgentRunOut(BaseModel):
    id: str
    request_text: str
    status: str
    current_step: str
    iteration_count: int
    final_response: str
    error: str
    messages: list[AgentMessageOut]
    tool_executions: list[ToolExecutionOut]
    created_at: datetime

    class Config:
        from_attributes = True
