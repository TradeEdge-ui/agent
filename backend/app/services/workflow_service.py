"""The workflow engine (spec #37/#38): TRIGGER -> ACTION -> CONDITION ->
ACTION -> RESULT, represented as structured Workflow/WorkflowStep rows
instead of hardcoded commands.

Workflows run unattended (by the user clicking "Run now" or by the
scheduler), so they are restricted to LOW-risk tools only -- both at
creation time (`validate_workflow_steps`) and again at execution time via
the SAME `requires_approval` policy the interactive agent uses, so a
workflow can never silently perform an action that would otherwise have
stopped for human sign-off (e.g. under SUGGEST autonomy, where even
LOW-risk writes require approval).
"""
import json
import logging
import time
from datetime import datetime, timezone

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.agent.policy import requires_approval
from app.models.business import Business
from app.models.workflow import Workflow, WorkflowRun, WorkflowStep
from app.schemas.workflow import WorkflowStepIn
from app.services.audit_service import write_audit_log
from app.services.notification_service import default_notification_provider
from app.tools import get_tool
from app.tools.registry import ToolError

logger = logging.getLogger("workflow")

CONDITION_OPERATORS = {"eq", "ne", "gt", "lt", "contains", "exists"}


class WorkflowValidationError(Exception):
    """Raised when a workflow definition references a tool that isn't
    allowed to run unattended (not registered, or above LOW risk)."""


def validate_workflow_steps(steps: list[WorkflowStepIn]) -> None:
    for step in steps:
        if step.step_type == "CONDITION":
            if step.condition_operator not in CONDITION_OPERATORS:
                raise WorkflowValidationError(f"Unknown condition operator '{step.condition_operator}'.")
            if step.on_false not in ("stop", "skip_next"):
                raise WorkflowValidationError(f"Unknown on_false behavior '{step.on_false}'.")
            continue
        if step.step_type != "TOOL_CALL":
            raise WorkflowValidationError(f"Unknown step type '{step.step_type}'.")
        spec = get_tool(step.tool_name)
        if not spec:
            raise WorkflowValidationError(f"Unknown tool '{step.tool_name}'.")
        if spec.risk != "LOW":
            raise WorkflowValidationError(
                f"Tool '{step.tool_name}' is {spec.risk} risk and cannot be used in an unattended "
                "workflow -- only LOW-risk tools are allowed. Run it through the AI Agent chat instead, "
                "where it goes through the Approval Center."
            )


def _resolve_path(data: dict, path: str):
    current = data
    for part in path.split("."):
        if isinstance(current, dict):
            if part not in current:
                return None, False
            current = current[part]
        elif isinstance(current, list):
            try:
                idx = int(part)
            except ValueError:
                return None, False
            if idx < 0 or idx >= len(current):
                return None, False
            current = current[idx]
        else:
            return None, False
    return current, True


def _evaluate_condition(prev_output: dict | None, step: WorkflowStep) -> tuple[bool, str]:
    value, found = _resolve_path(prev_output or {}, step.condition_field) if step.condition_field else (None, False)
    op = step.condition_operator
    if op == "exists":
        passed = found and value is not None
        return passed, f"{step.condition_field} exists -> {passed}"
    if not found:
        return False, f"{step.condition_field} not found in previous step output"
    target = step.condition_value
    try:
        if op == "eq":
            passed = str(value) == target
        elif op == "ne":
            passed = str(value) != target
        elif op == "gt":
            passed = float(value) > float(target)
        elif op == "lt":
            passed = float(value) < float(target)
        elif op == "contains":
            passed = target in value if isinstance(value, (list, str)) else target in str(value)
        else:
            passed = False
    except (TypeError, ValueError):
        passed = False
    return passed, f"{step.condition_field} {op} {target!r} (actual={value!r}) -> {passed}"


def _execute_tool_call(db: Session, business: Business, user_id: str, step: WorkflowStep) -> dict:
    spec = get_tool(step.tool_name)
    if not spec:
        return {"success": False, "error": f"Unknown tool '{step.tool_name}'."}

    needs_approval = requires_approval(tool_write=spec.write, tool_risk=spec.risk, autonomy_level=business.autonomy_level)
    if needs_approval:
        return {
            "success": False,
            "error": (
                f"'{step.tool_name}' requires approval under the current '{business.autonomy_level}' autonomy "
                "level and cannot run unattended. Switch autonomy to DRAFT/EXECUTE, or run this action "
                "through the AI Agent chat instead."
            ),
        }

    try:
        raw_input = json.loads(step.tool_input_json or "{}")
        params = spec.input_model.model_validate(raw_input)
    except (ValidationError, json.JSONDecodeError) as exc:
        return {"success": False, "error": f"Invalid input for {step.tool_name}: {exc}"}

    start = time.monotonic()
    try:
        output = spec.handler(db, business, user_id, params)
        return {"success": True, "output": output, "duration_ms": int((time.monotonic() - start) * 1000)}
    except ToolError as exc:
        return {"success": False, "error": str(exc)}
    except Exception:  # noqa: BLE001
        logger.exception("Unhandled error running workflow tool %s", step.tool_name)
        return {"success": False, "error": "An internal error occurred running this step."}


def execute_workflow(db: Session, business: Business, workflow: Workflow, *, triggered_by: str = "user", user_id: str = "system") -> WorkflowRun:
    run = WorkflowRun(
        workflow_id=workflow.id, business_id=business.id, status="RUNNING",
        triggered_by=triggered_by, started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    step_results: list[dict] = []
    last_output: dict | None = None
    skip_next = False
    failed = False

    for step in workflow.steps:
        if step.step_type == "CONDITION":
            passed, detail = _evaluate_condition(last_output, step)
            step_results.append({"step_id": step.id, "type": "CONDITION", "passed": passed, "detail": detail})
            if not passed:
                if step.on_false == "stop":
                    break
                skip_next = True
            continue

        if skip_next:
            step_results.append({"step_id": step.id, "type": "TOOL_CALL", "tool_name": step.tool_name, "skipped": True})
            skip_next = False
            continue

        result = _execute_tool_call(db, business, user_id, step)
        step_results.append({"step_id": step.id, "type": "TOOL_CALL", "tool_name": step.tool_name, **result})
        if result.get("success"):
            last_output = result.get("output") or {}
        else:
            failed = True
            run.error = result.get("error", "Step failed")
            break

    run.status = "FAILED" if failed else "COMPLETED"
    run.step_results_json = json.dumps(step_results)
    run.completed_at = datetime.now(timezone.utc)
    db.add(run)
    db.commit()
    db.refresh(run)

    write_audit_log(
        db, business_id=business.id, user_id=None, actor="system" if triggered_by == "scheduler" else triggered_by,
        action=f"Workflow '{workflow.name}' run {run.status.lower()}", tool_name="",
        input_summary=workflow.name, output_summary=json.dumps(step_results)[:2000],
        success=not failed, error=run.error,
    )
    default_notification_provider.notify(
        db, business_id=business.id, user_id=None,
        title=f"Workflow {'failed' if failed else 'completed'}: {workflow.name}",
        body=run.error if failed else f"Ran {len(step_results)} step(s) successfully.",
        level="warning" if failed else "info", link="/workflows",
    )
    return run
