import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.workflow import Workflow, WorkflowRun, WorkflowStep
from app.schemas.workflow import WorkflowCreate, WorkflowOut, WorkflowRunOut, WorkflowUpdate
from app.services import scheduler_service, workflow_service
from app.services.workflow_service import WorkflowValidationError

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _workflow_out(wf: Workflow) -> dict:
    return {
        "id": wf.id, "name": wf.name, "description": wf.description,
        "trigger_type": wf.trigger_type, "cron_expression": wf.cron_expression,
        "enabled": wf.enabled, "created_by": wf.created_by,
        "steps": [
            {
                "id": s.id, "order": s.order, "step_type": s.step_type, "tool_name": s.tool_name,
                "tool_input": json.loads(s.tool_input_json or "{}"),
                "condition_field": s.condition_field, "condition_operator": s.condition_operator,
                "condition_value": s.condition_value, "on_false": s.on_false,
            }
            for s in wf.steps
        ],
        "created_at": wf.created_at, "updated_at": wf.updated_at,
    }


def _run_out(run: WorkflowRun) -> dict:
    return {
        "id": run.id, "workflow_id": run.workflow_id, "status": run.status,
        "triggered_by": run.triggered_by, "step_results": json.loads(run.step_results_json or "[]"),
        "error": run.error, "started_at": run.started_at, "completed_at": run.completed_at,
        "created_at": run.created_at,
    }


def _replace_steps(db: Session, workflow: Workflow, steps) -> None:
    for existing in list(workflow.steps):
        db.delete(existing)
    db.flush()
    for i, step_in in enumerate(steps):
        db.add(WorkflowStep(
            workflow_id=workflow.id, order=i, step_type=step_in.step_type,
            tool_name=step_in.tool_name, tool_input_json=json.dumps(step_in.tool_input),
            condition_field=step_in.condition_field, condition_operator=step_in.condition_operator,
            condition_value=step_in.condition_value, on_false=step_in.on_false,
        ))


@router.get("", response_model=list[WorkflowOut])
def list_workflows(ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    workflows = (
        db.query(Workflow).filter(Workflow.business_id == ctx.business.id)
        .order_by(Workflow.created_at.desc()).all()
    )
    return [_workflow_out(w) for w in workflows]


@router.post("", response_model=WorkflowOut, status_code=201)
def create_workflow(payload: WorkflowCreate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    try:
        workflow_service.validate_workflow_steps(payload.steps)
    except WorkflowValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if payload.trigger_type == "CRON" and payload.cron_expression:
        from apscheduler.triggers.cron import CronTrigger
        try:
            CronTrigger.from_crontab(payload.cron_expression)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid cron expression: {exc}") from exc

    workflow = Workflow(
        business_id=ctx.business.id, name=payload.name, description=payload.description,
        trigger_type=payload.trigger_type, cron_expression=payload.cron_expression,
        enabled=payload.enabled, created_by="user",
    )
    db.add(workflow)
    db.flush()
    _replace_steps(db, workflow, payload.steps)
    db.commit()
    db.refresh(workflow)
    scheduler_service.schedule_workflow(workflow)
    return _workflow_out(workflow)


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.business_id == ctx.business.id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return _workflow_out(wf)


@router.patch("/{workflow_id}", response_model=WorkflowOut)
def update_workflow(workflow_id: str, payload: WorkflowUpdate, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.business_id == ctx.business.id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")

    data = payload.model_dump(exclude_unset=True, exclude={"steps"})
    if payload.steps is not None:
        try:
            workflow_service.validate_workflow_steps(payload.steps)
        except WorkflowValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    for field, value in data.items():
        setattr(wf, field, value)
    if payload.steps is not None:
        _replace_steps(db, wf, payload.steps)
    db.add(wf)
    db.commit()
    db.refresh(wf)
    scheduler_service.schedule_workflow(wf)
    return _workflow_out(wf)


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.business_id == ctx.business.id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    scheduler_service.unschedule_workflow(wf.id)
    db.delete(wf)
    db.commit()
    return None


@router.post("/{workflow_id}/run", response_model=WorkflowRunOut)
def run_workflow_now(workflow_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.business_id == ctx.business.id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    run = workflow_service.execute_workflow(db, ctx.business, wf, triggered_by="user", user_id=ctx.member.user_id)
    return _run_out(run)


@router.get("/{workflow_id}/runs", response_model=list[WorkflowRunOut])
def list_workflow_runs(workflow_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    wf = db.query(Workflow).filter(Workflow.id == workflow_id, Workflow.business_id == ctx.business.id).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    runs = (
        db.query(WorkflowRun).filter(WorkflowRun.workflow_id == wf.id)
        .order_by(WorkflowRun.created_at.desc()).limit(50).all()
    )
    return [_run_out(r) for r in runs]
