"""The agent loop.

INTENT/CONTEXT -> PLAN -> PERMISSION CHECK -> TOOL CALL -> VALIDATE -> UPDATE
-> DECIDE NEXT -> APPROVAL IF NEEDED -> CONTINUE -> FINAL -> AUDIT

Implemented as a single `_step_loop` that the initial run and every resume
(after an approval decision) both call, so an approval interruption resumes
the SAME run instead of restarting the workflow (spec section 45).
"""
import json
import re
import time
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.agent.llm_provider import LLMUnavailableError, get_llm_provider
from app.agent.policy import requires_approval
from app.agent.prompts import build_system_prompt
from app.core.config import get_settings
from app.models.agent import AgentMessage, AgentRun, ToolExecution
from app.models.approval import Approval
from app.models.business import Business
from app.services.approval_service import create_approval
from app.services.audit_service import write_audit_log
from app.services.notification_service import default_notification_provider
from app.tools import get_tool
from app.tools.registry import ToolError

settings = get_settings()


def _add_message(db: Session, run: AgentRun, role: str, content: str) -> AgentMessage:
    msg = AgentMessage(run_id=run.id, role=role, content=content)
    db.add(msg)
    db.commit()
    return msg


def _llm_messages_from_history(run: AgentRun) -> list[dict]:
    """Maps our stored roles (user/assistant/tool) onto a (user/assistant)
    sequence that every Ollama chat model understands, regardless of
    whether it supports a dedicated 'tool' role."""
    out = []
    for m in run.messages:
        if m.role == "assistant":
            out.append({"role": "assistant", "content": m.content})
        else:  # user or tool
            prefix = "" if m.role == "user" else "[TOOL RESULT] "
            out.append({"role": "user", "content": f"{prefix}{m.content}"})
    return out


def _parse_llm_json(text: str) -> dict | None:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _fail_run(db: Session, run: AgentRun, error: str) -> AgentRun:
    run.status = "FAILED"
    run.error = error
    run.final_response = f"I couldn't complete this request: {error}"
    run.completed_at = datetime.now(timezone.utc)
    db.add(run)
    db.commit()
    db.refresh(run)
    default_notification_provider.notify(
        db, business_id=run.business_id, user_id=run.user_id,
        title="Agent request failed", body=error, level="warning", link="/agent",
    )
    return run


def start_run(db: Session, business: Business, user_id: str, request_text: str) -> AgentRun:
    run = AgentRun(
        business_id=business.id, user_id=user_id, request_text=request_text,
        status="PENDING", started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    _add_message(db, run, "user", request_text)
    write_audit_log(
        db, business_id=business.id, user_id=user_id, run_id=run.id, actor="user",
        action="Submitted request to AI agent", input_summary=request_text,
    )
    return _step_loop(db, run, business, user_id)


def resume_run_after_approval(db: Session, run_id: str, ctx) -> AgentRun | None:
    run = db.get(AgentRun, run_id)
    if not run or run.status != "WAITING_FOR_APPROVAL":
        return run

    pending_exec = (
        db.query(ToolExecution)
        .filter(ToolExecution.run_id == run.id, ToolExecution.required_approval == True)  # noqa: E712
        .order_by(ToolExecution.created_at.desc())
        .first()
    )
    approval = db.get(Approval, pending_exec.approval_id) if pending_exec and pending_exec.approval_id else None

    if pending_exec and approval:
        if approval.status == "REJECTED":
            pending_exec.success = False
            pending_exec.error = "Rejected by the business owner."
            db.add(pending_exec)
            db.commit()
            write_audit_log(
                db, business_id=run.business_id, user_id=ctx.member.user_id, run_id=run.id, actor="user",
                action=f"Rejected agent action: {pending_exec.tool_name}", tool_name=pending_exec.tool_name,
                approval_required=True, approval_result="REJECTED",
            )
            _add_message(
                db, run, "tool",
                json.dumps({"tool": pending_exec.tool_name, "success": False, "error": "Rejected by the business owner."}),
            )
        else:
            spec = get_tool(pending_exec.tool_name)
            raw_input = json.loads(approval.edited_input_json) if approval.edited_input_json else json.loads(pending_exec.input_json)
            result = _execute_tool(db, run, ctx.business, ctx.member.user_id, spec, raw_input)
            pending_exec.output_json = json.dumps(_tool_output_payload(result))
            pending_exec.success = result.get("success", True)
            pending_exec.error = result.get("error", "")
            db.add(pending_exec)
            db.commit()
            write_audit_log(
                db, business_id=run.business_id, user_id=ctx.member.user_id, run_id=run.id, actor="agent",
                action=f"Executed approved action: {pending_exec.tool_name}", tool_name=pending_exec.tool_name,
                input_summary=json.dumps(raw_input), output_summary=json.dumps(result),
                approval_required=True, approval_result=approval.status, success=pending_exec.success,
            )
            _add_message(db, run, "tool", json.dumps({"tool": pending_exec.tool_name, **result}))

    run.status = "RUNNING"
    db.add(run)
    db.commit()
    db.refresh(run)
    return _step_loop(db, run, ctx.business, run.user_id)


def _tool_output_payload(result: dict) -> dict:
    """The clean, unwrapped payload stored as ToolExecution.output_json and
    exposed via the API -- just the handler's own return value (or the error),
    never the internal success/duration bookkeeping wrapper."""
    if result.get("success"):
        return result.get("output", {})
    return {"error": result.get("error", "Unknown error")}


def _execute_tool(db: Session, run: AgentRun, business: Business, user_id: str, spec, raw_input: dict) -> dict:
    try:
        params = spec.input_model.model_validate(raw_input)
    except ValidationError as exc:
        return {"success": False, "error": f"Invalid input for {spec.name}: {exc}"}

    start = time.monotonic()
    try:
        output = spec.handler(db, business, user_id, params)
        duration_ms = int((time.monotonic() - start) * 1000)
        return {"success": True, "output": output, "duration_ms": duration_ms}
    except ToolError as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        return {"success": False, "error": str(exc), "duration_ms": duration_ms}
    except Exception as exc:  # noqa: BLE001
        # Never leak internal stack traces to the model/user; log server-side only.
        import logging

        logging.getLogger("agent.tools").exception("Unhandled error in tool %s", spec.name)
        duration_ms = int((time.monotonic() - start) * 1000)
        return {"success": False, "error": "An internal error occurred running this tool.", "duration_ms": duration_ms}


def _step_loop(db: Session, run: AgentRun, business: Business, user_id: str) -> AgentRun:
    provider = get_llm_provider(business)
    available, status_message = provider.is_available()
    if not available:
        return _fail_run(db, run, status_message)

    run.status = "RUNNING"
    db.add(run)
    db.commit()

    system_prompt = build_system_prompt(business)
    start_time = time.monotonic()
    recent_calls: list[tuple[str, str]] = []

    while True:
        db.refresh(run)
        if run.iteration_count >= settings.AGENT_MAX_ITERATIONS:
            return _fail_run(db, run, "Reached the maximum number of reasoning steps without a final answer.")
        if time.monotonic() - start_time > settings.AGENT_TIMEOUT_SECONDS:
            return _fail_run(db, run, "The agent took too long to respond and was stopped.")

        run.iteration_count += 1
        db.add(run)
        db.commit()

        messages = _llm_messages_from_history(run)
        try:
            response = provider.generate(system_prompt=system_prompt, messages=messages)
        except LLMUnavailableError as exc:
            return _fail_run(db, run, str(exc))

        parsed = _parse_llm_json(response.text)
        if not parsed or "action" not in parsed:
            _add_message(db, run, "assistant", response.text)
            _add_message(
                db, run, "tool",
                json.dumps({"error": "Your last reply was not valid JSON in the required format. "
                                      "Respond with ONLY one JSON object as instructed."}),
            )
            continue

        _add_message(db, run, "assistant", json.dumps(parsed))
        action = parsed.get("action")

        if action == "final":
            run.final_response = parsed.get("response", "")
            run.status = "COMPLETED"
            run.current_step = "Completed"
            run.completed_at = datetime.now(timezone.utc)
            db.add(run)
            db.commit()
            write_audit_log(
                db, business_id=business.id, user_id=user_id, run_id=run.id, actor="agent",
                action="Agent completed run", output_summary=run.final_response,
            )
            db.refresh(run)
            if run.tool_executions:
                default_notification_provider.notify(
                    db, business_id=business.id, user_id=user_id,
                    title="Agent task completed", body=run.final_response[:300], level="info", link="/agent",
                )
            return run

        if action == "ask_user":
            run.final_response = parsed.get("question", "Could you clarify your request?")
            run.status = "COMPLETED"
            run.current_step = "Waiting for user clarification"
            run.completed_at = datetime.now(timezone.utc)
            db.add(run)
            db.commit()
            db.refresh(run)
            return run

        if action != "tool_call":
            _add_message(db, run, "tool", json.dumps({"error": f"Unknown action '{action}'. Use tool_call, ask_user, or final."}))
            continue

        tool_name = parsed.get("tool", "")
        raw_input = parsed.get("input", {}) or {}
        spec = get_tool(tool_name)

        if not spec:
            _add_message(db, run, "tool", json.dumps({"error": f"Unknown tool '{tool_name}'."}))
            continue

        call_signature = (tool_name, json.dumps(raw_input, sort_keys=True))
        if recent_calls.count(call_signature) >= 1 and recent_calls[-1:] == [call_signature]:
            return _fail_run(db, run, f"Stopped: '{tool_name}' was called twice in a row with identical input without progress.")
        recent_calls.append(call_signature)

        run.current_step = f"Calling {tool_name}"
        db.add(run)
        db.commit()

        needs_approval = requires_approval(
            tool_write=spec.write, tool_risk=spec.risk, autonomy_level=business.autonomy_level
        )

        if needs_approval:
            approval = create_approval(
                db, business_id=business.id, run_id=run.id,
                action=f"Run tool '{tool_name}'",
                reason=parsed.get("thought", f"The agent wants to run {tool_name}."),
                data=raw_input,
                expected_result=f"Executes {tool_name} with the given input and applies its effect.",
                risk_level=spec.risk, tool_name=tool_name, tool_input=raw_input,
            )
            tool_exec = ToolExecution(
                run_id=run.id, tool_name=tool_name, input_json=json.dumps(raw_input),
                output_json="{}", success=False, required_approval=True, approval_id=approval.id,
            )
            db.add(tool_exec)
            run.status = "WAITING_FOR_APPROVAL"
            run.current_step = f"Waiting for approval to run {tool_name}"
            db.add(run)
            db.commit()
            write_audit_log(
                db, business_id=business.id, user_id=user_id, run_id=run.id, actor="agent",
                action=f"Requested approval to run {tool_name}", tool_name=tool_name,
                input_summary=json.dumps(raw_input), approval_required=True, approval_result="PENDING",
            )
            db.refresh(run)
            default_notification_provider.notify(
                db, business_id=business.id, user_id=user_id,
                title=f"Approval needed: {tool_name}", body=parsed.get("thought", ""),
                level="action_required", link="/approvals",
            )
            return run

        result = _execute_tool(db, run, business, user_id, spec, raw_input)
        tool_exec = ToolExecution(
            run_id=run.id, tool_name=tool_name, input_json=json.dumps(raw_input),
            output_json=json.dumps(_tool_output_payload(result)), success=result.get("success", False),
            error=result.get("error", ""), duration_ms=result.get("duration_ms", 0),
            required_approval=False,
        )
        db.add(tool_exec)
        db.commit()
        write_audit_log(
            db, business_id=business.id, user_id=user_id, run_id=run.id, actor="agent",
            action=f"Executed tool {tool_name}", tool_name=tool_name,
            input_summary=json.dumps(raw_input), output_summary=json.dumps(result),
            success=result.get("success", False), error=result.get("error", ""),
        )
        _add_message(db, run, "tool", json.dumps({"tool": tool_name, **result}))
