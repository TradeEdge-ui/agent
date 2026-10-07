# Workflows (automation routines)

A workflow is a saved, reusable routine: **TRIGGER -> ACTION -> CONDITION ->
ACTION -> RESULT**, stored as structured rows (`Workflow` / `WorkflowStep` /
`WorkflowRun`) instead of hardcoded commands. Think "start my work setup" or
"every weekday at 9am, remind me to review my schedule."

## Why workflows are restricted to LOW-risk tools

Workflows run **unattended** -- by a click, by the AI agent calling
`run_workflow`, or by the scheduler firing in the background with nobody
watching. The interactive AI Agent chat has a human in the loop who can
approve or reject a risky action as it happens; a workflow does not. So:

- At **creation time** (`POST`/`PATCH /api/workflows`), every `TOOL_CALL`
  step must reference a tool whose risk is `LOW` (see `docs/TOOLS.md`).
  Anything MEDIUM/HIGH is rejected with a 400 explaining why, and pointing
  at the AI Agent chat instead.
- At **execution time**, the engine re-checks the exact same
  `requires_approval()` policy the interactive agent uses. This matters
  because autonomy level is a *business* setting that can change after a
  workflow was created: under `SUGGEST` autonomy, even a LOW-risk write
  requires approval, so a workflow step would otherwise silently bypass
  that. Instead, the step fails with a clear error and the run is marked
  `FAILED` -- it never runs the action anyway "just this once."

This means a workflow can create tasks, schedule follow-ups, open/read
webpages, etc., but it can never issue an invoice, send a customer message,
or do anything the project's own safety rules say always needs a human.

## Steps

Two step types:

- **`TOOL_CALL`**: `tool_name` + `tool_input` (JSON). Runs exactly like a
  single agent tool call, with the same input validation and audit logging.
- **`CONDITION`**: compares a dotted field path (`condition_field`) in the
  *previous* step's tool output against `condition_value` using
  `condition_operator` (`eq`/`ne`/`gt`/`lt`/`contains`/`exists`). If the
  condition is false, `on_false` decides what happens next:
  - `stop`: the run ends there (status `COMPLETED`, remaining steps never run).
  - `skip_next`: only the very next step is skipped; the run continues after that.

Steps run strictly in order. If a `TOOL_CALL` step fails (invalid input, the
tool raising an error, or needing approval it can't get), the run stops
immediately and is marked `FAILED` with the error recorded.

## Triggers

- **`MANUAL`**: runs only when triggered -- from the Workflows page ("Run
  now"), via the API (`POST /api/workflows/{id}/run`), or by the agent
  calling the `run_workflow` tool by name (e.g. the user says "start my work
  setup").
- **`CRON`**: a standard 5-field cron expression (UTC), scheduled with
  [APScheduler](https://apscheduler.readthedocs.io/)'s `BackgroundScheduler`
  running inside the backend process. This is real scheduling, not a
  simulation -- but it only fires while the backend process is running,
  exactly like any other local background service. Enabling/disabling a
  workflow, or deleting it, immediately (un)registers its APScheduler job;
  all enabled `CRON` workflows are re-registered on backend startup.

## Every run is recorded

A `WorkflowRun` row records `status` (`RUNNING`/`COMPLETED`/`FAILED`),
`triggered_by` (`user`/`agent`/`scheduler`), the full `step_results` (per
step: success/output, or skipped/condition result), and `error` if it
failed. Every run also writes an `AuditLog` entry and an in-app
`Notification` (surfaced to the frontend as a real desktop notification --
see `docs/VOICE.md` for the notification plumbing).

## What's intentionally not here

- No visual drag-and-drop workflow builder -- steps are edited as a list
  with a JSON field for tool input. A richer builder is straightforward to
  add on top of the same API without touching the engine.
- No parallel/branching steps -- only a linear sequence with simple
  stop/skip conditions. Sufficient for routines like "start my work setup";
  more complex branching would need a small DAG executor instead of the
  current linear loop in `workflow_service.execute_workflow`.
- Scheduled workflows don't survive the backend process being down the
  whole time a fire was due -- APScheduler's in-process scheduler doesn't
  catch up missed fires retroactively. A persisted job store (APScheduler
  supports one) would be the next step if that matters for a given
  deployment.
