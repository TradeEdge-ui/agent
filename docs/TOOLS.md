# Tool Registry

The agent can only affect the system through tools registered in
`backend/app/tools/registry.py`. Each tool declares:

- a Pydantic **input schema** (validated before the handler ever runs),
- a **risk** tier (`LOW` / `MEDIUM` / `HIGH`),
- whether it **writes** data (read-only tools never require approval),
- a handler `(db, business, user_id, params) -> dict` that raises
  `ToolError` for an expected failure (not found, invalid reference) rather
  than crashing.

The orchestrator never calls a handler with unvalidated input, and every
call -- successful or not -- is recorded as a `ToolExecution` and an
`AuditLog` entry.

## Implemented tools

### CRM (`app/tools/crm_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `search_customers` | no | - |
| `get_customer` | no | - |
| `create_customer` | yes | LOW |
| `update_customer` | yes | MEDIUM |
| `create_contact` | yes | LOW |
| `search_contacts` | no | - |
| `search_leads` | no | - |
| `create_lead` | yes | LOW |
| `update_lead` | yes | LOW |
| `change_lead_stage` | yes | MEDIUM |
| `record_interaction` | yes | LOW |

### Tasks & follow-ups (`app/tools/task_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `search_tasks` | no | - |
| `create_task` | yes | LOW |
| `update_task` | yes | LOW |
| `complete_task` | yes | LOW |
| `create_follow_up` | yes | LOW |
| `find_overdue_follow_ups` | no | - |

### Quotations & invoices (`app/tools/finance_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `calculate_quote_total` | no | - |
| `create_quote` | yes | LOW |
| `get_quote` | no | - |
| `update_quote` | yes | MEDIUM |
| `submit_quote_for_approval` | yes | LOW |
| `create_invoice_draft` | yes | LOW |
| `get_invoice` | no | - |
| `calculate_invoice_total` | no | - |
| `issue_invoice` | yes | **HIGH** -- finalizing a financial document |

### Documents (`app/tools/document_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `search_documents` | no | - |
| `extract_document_information` | no | - |

### Knowledge & business memory (`app/tools/knowledge_tools.py`, `business_rule_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `search_knowledge_base` | no | - |
| `retrieve_business_rule` | no | - |
| `propose_business_rule` | yes | LOW (never silently overwrites a confirmed rule -- see below) |

### Approvals & summaries (`app/tools/approval_tools.py`, `summary_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `list_pending_approvals` | no | - |
| `create_approval_request` | yes | LOW (its only effect is filing the request) |
| `get_daily_summary` | no | - |
| `get_business_summary` | no | - |
| `get_agent_history` | no | - |

### Messaging (`app/tools/messaging_tools.py`)
| Tool | Write | Risk |
|---|---|---|
| `send_customer_message` | yes | **HIGH** -- an external, customer-facing action. No real email/SMS provider is wired up in the MVP; the handler records an outbound `Interaction` and its result explicitly states `actually_sent: false` rather than claiming delivery. |

Note: `approve_action` / `reject_action` from the original tool list are
**intentionally not agent-callable tools** -- an agent approving its own
high-risk request would defeat the approval mechanism. They exist only as
user-triggered API endpoints (`POST /api/approvals/{id}/approve|reject`).
`write_audit_log` is likewise system-internal, not agent-invocable; every
tool call is audited automatically by the orchestrator.

## Adding a new tool

1. Write a Pydantic input model.
2. Write a handler function; raise `ToolError(message)` for expected
   failures.
3. Decorate it with `@tool(name, description, input_model, risk=..., write=...)`
   in the relevant `app/tools/*.py` file.
4. Import that module from `app/tools/__init__.py` (new files need adding to
   the import list).

Nothing else needs to change -- the prompt's tool catalog, input validation,
and approval policy all read from the registry automatically.
