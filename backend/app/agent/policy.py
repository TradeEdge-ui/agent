"""Autonomy-level policy: decides whether a tool call may run immediately or
must be routed through the Approval Center first.

Three autonomy levels (spec section 13):
  SUGGEST  - the agent never writes; every write tool becomes a proposal.
  DRAFT    - low/medium risk internal actions (drafts, records, tasks) run
             immediately; anything HIGH risk still needs sign-off.
  EXECUTE  - low AND medium risk actions run immediately; HIGH risk still
             always needs sign-off -- autonomy never extends to the
             explicitly sensitive action list (sending messages, pricing,
             finalizing financial documents, deletions, irreversible
             external actions).
"""
RISK_LOW = "LOW"
RISK_MEDIUM = "MEDIUM"
RISK_HIGH = "HIGH"

AUTONOMY_LEVELS = ["SUGGEST", "DRAFT", "EXECUTE"]


def requires_approval(*, tool_write: bool, tool_risk: str, autonomy_level: str) -> bool:
    if not tool_write:
        return False
    if tool_risk == RISK_HIGH:
        return True
    if autonomy_level == "SUGGEST":
        return True
    if autonomy_level == "DRAFT":
        return tool_risk == RISK_MEDIUM
    if autonomy_level == "EXECUTE":
        return False
    return True  # unknown autonomy level -> fail safe
