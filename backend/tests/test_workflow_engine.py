"""Workflow engine tests (spec #37/#38/#68): TRIGGER -> ACTION -> CONDITION
-> ACTION -> RESULT, running real tool calls against the real database --
not a simulated response."""
from app.services import scheduler_service


def test_create_workflow_rejects_non_low_risk_tool(client, auth_headers):
    resp = client.post(
        "/api/workflows",
        json={
            "name": "Risky routine",
            "steps": [{"step_type": "TOOL_CALL", "tool_name": "issue_invoice", "tool_input": {"invoice_id": "x"}}],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert "cannot be used" in resp.json()["detail"]


def test_create_workflow_rejects_unknown_tool(client, auth_headers):
    resp = client.post(
        "/api/workflows",
        json={"name": "Bad routine", "steps": [{"step_type": "TOOL_CALL", "tool_name": "nonexistent_tool", "tool_input": {}}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_workflow_executes_tool_call_and_condition_steps_for_real(client, auth_headers):
    customer = client.post("/api/customers", json={"name": "Workflow Customer"}, headers=auth_headers).json()

    create = client.post(
        "/api/workflows",
        json={
            "name": "Morning Routine",
            "trigger_type": "MANUAL",
            "steps": [
                {"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "Daily check-in"}},
                {"step_type": "CONDITION", "condition_field": "created", "condition_operator": "eq",
                 "condition_value": "True", "on_false": "stop"},
                {"step_type": "TOOL_CALL", "tool_name": "create_follow_up",
                 "tool_input": {"customer_id": customer["id"], "days_from_now": 2, "reason": "workflow follow-up"}},
            ],
        },
        headers=auth_headers,
    )
    assert create.status_code == 201, create.text
    workflow = create.json()
    assert len(workflow["steps"]) == 3

    run_resp = client.post(f"/api/workflows/{workflow['id']}/run", headers=auth_headers)
    assert run_resp.status_code == 200
    run = run_resp.json()
    assert run["status"] == "COMPLETED", run
    assert len(run["step_results"]) == 3
    assert all(r.get("success", True) for r in run["step_results"] if r["type"] == "TOOL_CALL")

    tasks = client.get("/api/tasks", headers=auth_headers).json()
    assert any(t["title"] == "Daily check-in" for t in tasks)
    follow_ups = client.get("/api/follow-ups", headers=auth_headers).json()
    assert any(f["reason"] == "workflow follow-up" and f["customer_id"] == customer["id"] for f in follow_ups)

    notes = client.get("/api/notifications", headers=auth_headers).json()
    assert any("Morning Routine" in n["title"] for n in notes)


def test_workflow_condition_false_with_stop_skips_remaining_steps(client, auth_headers):
    create = client.post(
        "/api/workflows",
        json={
            "name": "Conditional Routine",
            "steps": [
                {"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "Step one"}},
                {"step_type": "CONDITION", "condition_field": "nonexistent_field", "condition_operator": "exists",
                 "condition_value": "", "on_false": "stop"},
                {"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "Should never run"}},
            ],
        },
        headers=auth_headers,
    )
    workflow = create.json()

    run = client.post(f"/api/workflows/{workflow['id']}/run", headers=auth_headers).json()
    assert run["status"] == "COMPLETED"
    assert len(run["step_results"]) == 2  # the stop halted before the third step ran
    assert run["step_results"][1]["passed"] is False

    tasks = client.get("/api/tasks", headers=auth_headers).json()
    assert not any(t["title"] == "Should never run" for t in tasks)


def test_workflow_step_requiring_approval_fails_instead_of_running_unattended(client, auth_headers):
    client.patch("/api/business", json={"autonomy_level": "SUGGEST"}, headers=auth_headers)
    create = client.post(
        "/api/workflows",
        json={"name": "Suggest Routine", "steps": [{"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "Should not auto-run"}}]},
        headers=auth_headers,
    )
    workflow = create.json()

    run = client.post(f"/api/workflows/{workflow['id']}/run", headers=auth_headers).json()
    assert run["status"] == "FAILED"
    assert "requires approval" in run["error"].lower()

    tasks = client.get("/api/tasks", headers=auth_headers).json()
    assert not any(t["title"] == "Should not auto-run" for t in tasks)


def test_cron_workflow_is_registered_with_the_scheduler(client, auth_headers):
    create = client.post(
        "/api/workflows",
        json={
            "name": "Daily 9am Reminder",
            "trigger_type": "CRON",
            "cron_expression": "0 9 * * *",
            "enabled": True,
            "steps": [{"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "Review schedule"}}],
        },
        headers=auth_headers,
    )
    workflow = create.json()
    job = scheduler_service.get_scheduler().get_job(scheduler_service._job_id(workflow["id"]))
    assert job is not None
    assert job.trigger is not None

    client.patch(f"/api/workflows/{workflow['id']}", json={"enabled": False}, headers=auth_headers)
    assert scheduler_service.get_scheduler().get_job(scheduler_service._job_id(workflow["id"])) is None

    client.delete(f"/api/workflows/{workflow['id']}", headers=auth_headers)


def test_invalid_cron_expression_is_rejected(client, auth_headers):
    resp = client.post(
        "/api/workflows",
        json={"name": "Bad cron", "trigger_type": "CRON", "cron_expression": "not a cron",
              "steps": [{"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "x"}}]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_agent_can_list_and_run_a_workflow_via_tools(client, auth_headers, monkeypatch):
    import app.agent.orchestrator as orchestrator_module
    from tests.fake_llm import FakeLLMProvider

    client.post(
        "/api/workflows",
        json={"name": "Agent Triggered Routine", "steps": [{"step_type": "TOOL_CALL", "tool_name": "create_task", "tool_input": {"title": "From workflow"}}]},
        headers=auth_headers,
    )

    fake = FakeLLMProvider([
        {"thought": "run the routine", "action": "tool_call", "tool": "run_workflow", "input": {"name": "Agent Triggered Routine"}},
        {"thought": "done", "action": "final", "response": "Routine started."},
    ])
    monkeypatch.setattr(orchestrator_module, "get_llm_provider", lambda business: fake)

    resp = client.post("/api/agent/run", json={"message": "Start my agent triggered routine"}, headers=auth_headers)
    run = resp.json()
    assert run["status"] == "COMPLETED"
    assert run["tool_executions"][0]["output"]["status"] == "COMPLETED"

    tasks = client.get("/api/tasks", headers=auth_headers).json()
    assert any(t["title"] == "From workflow" for t in tasks)
