import json

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.agent.llm_provider import get_llm_provider
from app.agent.orchestrator import start_run
from app.api.deps import BusinessContext, get_current_business
from app.database.session import get_db
from app.models.agent import AgentRun
from app.schemas.agent import AgentRunOut, AgentRunRequest

router = APIRouter(prefix="/api/agent", tags=["agent"])


def _run_out(run: AgentRun) -> dict:
    return {
        "id": run.id, "request_text": run.request_text, "status": run.status,
        "current_step": run.current_step, "iteration_count": run.iteration_count,
        "final_response": run.final_response, "error": run.error,
        "messages": [{"role": m.role, "content": m.content, "created_at": m.created_at} for m in run.messages],
        "tool_executions": [
            {
                "tool_name": t.tool_name, "input": json.loads(t.input_json or "{}"),
                "output": json.loads(t.output_json or "{}"), "success": t.success,
                "error": t.error, "required_approval": t.required_approval,
            }
            for t in run.tool_executions
        ],
        "created_at": run.created_at,
    }


@router.post("/run", response_model=AgentRunOut)
def run_agent(payload: AgentRunRequest, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    run = start_run(db, ctx.business, ctx.member.user_id, payload.message)
    return _run_out(run)


@router.get("/runs", response_model=list[AgentRunOut])
def list_runs(limit: int = 20, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    runs = (
        db.query(AgentRun)
        .filter(AgentRun.business_id == ctx.business.id)
        .order_by(AgentRun.created_at.desc())
        .limit(min(limit, 100))
        .all()
    )
    return [_run_out(r) for r in runs]


@router.get("/runs/{run_id}", response_model=AgentRunOut)
def get_run(run_id: str, ctx: BusinessContext = Depends(get_current_business), db: Session = Depends(get_db)):
    run = db.query(AgentRun).filter(AgentRun.id == run_id, AgentRun.business_id == ctx.business.id).first()
    if not run:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Agent run not found")
    return _run_out(run)


@router.get("/status")
def agent_status(ctx: BusinessContext = Depends(get_current_business)):
    provider = get_llm_provider(ctx.business)
    available, message = provider.is_available()
    return {
        "provider": ctx.business.ai_provider, "model": ctx.business.ai_model,
        "available": available, "message": message, "autonomy_level": ctx.business.autonomy_level,
    }
