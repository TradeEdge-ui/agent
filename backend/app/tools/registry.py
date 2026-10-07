"""The tool registry: the ONLY way the agent is allowed to touch the database.

Every tool is validated input -> handler -> structured output. The agent
never runs arbitrary queries. Each ToolSpec carries the metadata the
approval policy needs (`write`, `risk`) so permission enforcement happens
in one place (see app/agent/policy.py) rather than being re-implemented
per tool.
"""
from dataclasses import dataclass
from typing import Callable

from pydantic import BaseModel
from sqlalchemy.orm import Session


class ToolError(Exception):
    """Raised by a tool handler for an expected, user-facing failure
    (not found, invalid reference, etc). Caught by the orchestrator and
    reported back to the model as a failed tool result, never swallowed."""


@dataclass
class ToolSpec:
    name: str
    description: str
    input_model: type[BaseModel]
    handler: Callable[[Session, "Business", str, BaseModel], dict]  # noqa: F821
    risk: str = "LOW"
    write: bool = False


_REGISTRY: dict[str, ToolSpec] = {}


def tool(name: str, description: str, input_model: type[BaseModel], risk: str = "LOW", write: bool = False):
    def _decorator(func: Callable):
        _REGISTRY[name] = ToolSpec(
            name=name, description=description, input_model=input_model,
            handler=func, risk=risk, write=write,
        )
        return func

    return _decorator


def get_tool(name: str) -> ToolSpec | None:
    return _REGISTRY.get(name)


def all_tools() -> list[ToolSpec]:
    return list(_REGISTRY.values())


def tool_catalog_for_prompt() -> str:
    lines = []
    for spec in all_tools():
        schema = spec.input_model.model_json_schema()
        props = schema.get("properties", {})
        required = set(schema.get("required", []))
        arg_desc = ", ".join(
            f"{name}{'' if name in required else '?'}: {info.get('type', 'any')}"
            for name, info in props.items()
        )
        lines.append(f"- {spec.name}({arg_desc}): {spec.description}")
    return "\n".join(lines)
