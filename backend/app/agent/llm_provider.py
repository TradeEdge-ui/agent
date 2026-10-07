"""LLM provider abstraction.

Nothing in the agent orchestrator talks to Ollama (or any future hosted
API) directly -- everything goes through this interface, so adding a
hosted provider later means writing one new class, not touching the
orchestrator or tools.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from app.core.config import get_settings


class LLMUnavailableError(Exception):
    """Raised when the configured provider cannot be reached or used."""


@dataclass
class LLMResponse:
    text: str
    raw: dict | None = None


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, *, system_prompt: str, messages: list[dict], temperature: float = 0.2) -> LLMResponse:
        """messages: list of {"role": "user"|"assistant", "content": str}."""
        ...

    @abstractmethod
    def is_available(self) -> tuple[bool, str]:
        """Returns (available, status_message)."""
        ...


class OllamaProvider(LLMProvider):
    def __init__(self, base_url: str | None = None, model: str | None = None):
        settings = get_settings()
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.OLLAMA_MODEL

    def is_available(self) -> tuple[bool, str]:
        try:
            resp = httpx.get(f"{self.base_url}/api/tags", timeout=3.0)
            resp.raise_for_status()
            tags = [m.get("name", "") for m in resp.json().get("models", [])]
            if self.model not in tags and not any(t.startswith(self.model) for t in tags):
                return False, (
                    f"Ollama is running but model '{self.model}' is not installed. "
                    f"Run: ollama pull {self.model}"
                )
            return True, "Ollama is reachable and the model is installed."
        except httpx.ConnectError:
            return False, (
                f"Could not connect to Ollama at {self.base_url}. "
                "Is Ollama running? Start it with 'ollama serve'."
            )
        except Exception as exc:  # noqa: BLE001
            return False, f"Ollama health check failed: {exc}"

    def generate(self, *, system_prompt: str, messages: list[dict], temperature: float = 0.2) -> LLMResponse:
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": system_prompt}, *messages],
            "stream": False,
            "options": {"temperature": temperature},
        }
        try:
            resp = httpx.post(f"{self.base_url}/api/chat", json=payload, timeout=120.0)
            resp.raise_for_status()
        except httpx.ConnectError as exc:
            raise LLMUnavailableError(
                f"Could not connect to Ollama at {self.base_url}. Is it running?"
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise LLMUnavailableError(f"Ollama returned an error: {exc.response.text}") from exc

        data = resp.json()
        content = data.get("message", {}).get("content", "")
        return LLMResponse(text=content, raw=data)


class NullProvider(LLMProvider):
    """Used when AI_PROVIDER=none. Fails clearly instead of crashing."""

    def is_available(self) -> tuple[bool, str]:
        return False, "No AI provider is configured."

    def generate(self, *, system_prompt: str, messages: list[dict], temperature: float = 0.2) -> LLMResponse:
        raise LLMUnavailableError("No AI provider is configured.")


def get_llm_provider(business=None) -> LLMProvider:
    settings = get_settings()
    provider_name = (getattr(business, "ai_provider", None) or settings.AI_PROVIDER).lower()
    model = getattr(business, "ai_model", None) or settings.OLLAMA_MODEL
    if provider_name == "ollama":
        return OllamaProvider(model=model)
    return NullProvider()
