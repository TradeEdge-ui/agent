from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models.business import Business
from app.models.workflow import Workflow
from app.services import workflow_service
from app.tools.registry import ToolError, tool


class ListWorkflowsInput(BaseModel):
    pass


@tool("list_workflows", "List the business's saved automation workflows/routines and whether each is enabled.", ListWorkflowsInput)
def list_workflows(db: Session, business: Business, user_id: str, params: ListWorkflowsInput) -> dict:
    workflows = db.query(Workflow).filter(Workflow.business_id == business.id).all()
    return {
        "workflows": [
            {"id": w.id, "name": w.name, "trigger_type": w.trigger_type, "enabled": w.enabled, "step_count": len(w.steps)}
            for w in workflows
        ]
    }


class RunWorkflowInput(BaseModel):
    name: str


@tool(
    "run_workflow", "Run a saved automation workflow/routine by name right now (e.g. the user's "
    "'start my work setup' routine). The workflow only performs the LOW-risk steps it was built with.",
    RunWorkflowInput, risk="LOW", write=True,
)
def run_workflow(db: Session, business: Business, user_id: str, params: RunWorkflowInput) -> dict:
    workflow = (
        db.query(Workflow)
        .filter(Workflow.business_id == business.id, Workflow.name.ilike(params.name))
        .first()
    )
    if not workflow:
        raise ToolError(f"No workflow named '{params.name}' found. Use list_workflows to see what's available.")
    if not workflow.enabled:
        raise ToolError(f"Workflow '{workflow.name}' is disabled.")
    run = workflow_service.execute_workflow(db, business, workflow, triggered_by="agent", user_id="agent")
    return {"run_id": run.id, "status": run.status, "error": run.error}
