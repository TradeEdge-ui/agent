"""A scripted LLMProvider for deterministic agent-loop tests.

Lets tests drive the orchestrator exactly like a real model would (by
returning the same JSON action protocol) without needing Ollama installed.
"""
import json

from app.agent.llm_provider import LLMProvider, LLMResponse


class FakeLLMProvider(LLMProvider):
    def __init__(self, scripted_responses: list, cycle: bool = False):
        self._script = list(scripted_responses)
        self._queue = list(scripted_responses)
        self._cycle = cycle
        self.calls = 0

    def is_available(self) -> tuple[bool, str]:
        return True, "fake provider always available"

    def generate(self, *, system_prompt: str, messages: list[dict], temperature: float = 0.2) -> LLMResponse:
        self.calls += 1
        if not self._queue and self._cycle and self._script:
            self._queue = list(self._script)
        if self._queue:
            next_action = self._queue.pop(0)
        else:
            next_action = {"thought": "done", "action": "final", "response": "No more scripted steps."}
        if isinstance(next_action, str):
            text = next_action
        else:
            text = json.dumps(next_action)
        return LLMResponse(text=text, raw=None)
