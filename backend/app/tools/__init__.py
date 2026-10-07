"""Importing this package registers every tool with the global registry."""
from app.tools.registry import ToolError, ToolSpec, all_tools, get_tool, tool_catalog_for_prompt  # noqa: F401

from app.tools import (  # noqa: F401
    approval_tools,
    browser_tools,
    business_rule_tools,
    crm_tools,
    document_tools,
    finance_tools,
    knowledge_tools,
    messaging_tools,
    summary_tools,
    task_tools,
    workflow_tools,
)
