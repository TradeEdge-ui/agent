"""Notifications (spec #36): real rows the frontend can poll to decide when
to fire a browser desktop notification. Verifies the backend actually
creates them on the events that matter, not just on request."""
import app.agent.orchestrator as orchestrator_module

from tests.fake_llm import FakeLLMProvider


def _use_fake(monkeypatch, provider: FakeLLMProvider):
    monkeypatch.setattr(orchestrator_module, "get_llm_provider", lambda business: provider)


def test_notification_created_when_agent_run_needs_approval(client, auth_headers, monkeypatch):
    client.patch("/api/business", json={"autonomy_level": "EXECUTE"}, headers=auth_headers)
    customer_id = client.post("/api/customers", json={"name": "Approval Customer"}, headers=auth_headers).json()["id"]

    fake = FakeLLMProvider([
        {"thought": "send message", "action": "tool_call", "tool": "send_customer_message",
         "input": {"customer_id": customer_id, "message": "hi"}},
        {"thought": "done", "action": "final", "response": "sent"},
    ])
    _use_fake(monkeypatch, fake)

    client.post("/api/agent/run", json={"message": "message the customer"}, headers=auth_headers)

    notes = client.get("/api/notifications?unread_only=true", headers=auth_headers).json()
    assert any(n["level"] == "action_required" and "Approval needed" in n["title"] for n in notes)


def test_notification_created_when_run_completes_with_tool_calls(client, auth_headers, monkeypatch):
    client.patch("/api/business", json={"autonomy_level": "EXECUTE"}, headers=auth_headers)
    fake = FakeLLMProvider([
        {"thought": "create task", "action": "tool_call", "tool": "create_task", "input": {"title": "Notify me"}},
        {"thought": "done", "action": "final", "response": "Task created."},
    ])
    _use_fake(monkeypatch, fake)

    client.post("/api/agent/run", json={"message": "create a task"}, headers=auth_headers)

    notes = client.get("/api/notifications", headers=auth_headers).json()
    assert any(n["level"] == "info" and "Agent task completed" in n["title"] for n in notes)


def test_no_notification_for_plain_qa_with_no_tool_calls(client, auth_headers, monkeypatch):
    fake = FakeLLMProvider([{"thought": "just answer", "action": "final", "response": "Hi there!"}])
    _use_fake(monkeypatch, fake)

    client.post("/api/agent/run", json={"message": "hello"}, headers=auth_headers)

    notes = client.get("/api/notifications", headers=auth_headers).json()
    assert not any(n["title"] == "Agent task completed" for n in notes)


def test_mark_notification_read(client, auth_headers, monkeypatch):
    fake = FakeLLMProvider([
        {"thought": "create task", "action": "tool_call", "tool": "create_task", "input": {"title": "x"}},
        {"thought": "done", "action": "final", "response": "done"},
    ])
    _use_fake(monkeypatch, fake)
    client.patch("/api/business", json={"autonomy_level": "EXECUTE"}, headers=auth_headers)
    client.post("/api/agent/run", json={"message": "create a task"}, headers=auth_headers)

    unread = client.get("/api/notifications?unread_only=true", headers=auth_headers).json()
    assert len(unread) >= 1
    note_id = unread[0]["id"]

    resp = client.post(f"/api/notifications/{note_id}/read", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["read"] is True

    unread_after = client.get("/api/notifications?unread_only=true", headers=auth_headers).json()
    assert not any(n["id"] == note_id for n in unread_after)
