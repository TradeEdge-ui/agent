# Architecture

## Layers

```
Frontend (React + TS)
    |  HTTP/JSON (JWT bearer token)
    v
API (FastAPI routers, app/api/routes/*)
    |
Application / Business Logic (app/services/*)
    |
Agent Orchestrator (app/agent/orchestrator.py)
    |
Tools (app/tools/*)  <-- the ONLY way the agent touches data
    |
Database (SQLAlchemy models, app/models/*) + Knowledge (app/services/knowledge_service.py)
```

Each layer only calls the layer below it. Routers never run raw SQL; they call
services. Services never call the LLM. The agent never queries the database
directly -- it can only act through registered, validated tools. This keeps
the system auditable: every database write that the agent causes has a name
(a tool), an input schema, and (for anything risky) an approval record.

## Request flow (a normal CRUD request)

`Frontend -> FastAPI router -> app/api/deps.py (auth + business scoping) -> service function -> SQLAlchemy -> SQLite`

Every router depends on `get_current_business`, which resolves the
authenticated user's business membership server-side and raises `403`/`404`
if the user doesn't belong to it. The frontend is never trusted to enforce
this -- see `docs/SECURITY.md`.

## Request flow (an AI agent request)

See `docs/AGENT.md` for the full loop. In short:

1. `POST /api/agent/run` creates an `AgentRun` row and calls
   `app/agent/orchestrator.py::start_run`.
2. The orchestrator builds a system prompt (business context + tool catalog +
   safety rules), sends the conversation to the configured `LLMProvider`, and
   parses a strict JSON action out of the reply.
3. If the model asks to call a tool, the orchestrator validates the input
   against that tool's Pydantic schema, checks the autonomy policy
   (`app/agent/policy.py`), and either executes it immediately or creates an
   `Approval` and pauses the run (`WAITING_FOR_APPROVAL`).
4. When the user approves/rejects via `POST /api/approvals/{id}/approve|reject`,
   `resume_run_after_approval` picks the same `AgentRun` back up -- it never
   restarts the workflow.
5. Every tool call, approval, and final answer is written to `AuditLog`.

## Directory layout

```
backend/
  app/
    api/routes/     FastAPI routers (HTTP only, no business logic)
    api/deps.py      auth + business-scoping dependencies
    agent/           orchestrator, LLM provider abstraction, prompts, policy
    tools/           the tool registry + one module per domain
    services/        business logic, reused by routers AND tools
    models/          SQLAlchemy ORM models
    schemas/         Pydantic request/response models
    security/        password hashing, JWT
    database/        engine/session setup
    core/config.py   environment-driven settings
  scripts/           demo data seeding
  tests/             pytest suite (unit + integration + agent-loop tests)
frontend/
  src/
    pages/           one file per route
    components/      shared UI building blocks
    layouts/         AppLayout (sidebar) / AuthLayout
    services/        typed API client functions
    state/            AuthContext
    types/            shared TypeScript interfaces mirroring backend schemas
docs/                 this folder
scripts/               repo-level convenience scripts (seed, backup, restore)
```

## Why these technology choices

- **SQLite**: zero setup, a single file, trivial to back up -- fits "runs on
  one Windows computer" (spec goal). Swappable later via `DATABASE_URL`
  because all access goes through SQLAlchemy.
- **No ORM-bypassing raw SQL, no separate "repository" indirection layer**:
  services call SQLAlchemy directly. Adding a repository layer on top would
  be an abstraction with no current payoff -- services are already the
  single place business logic lives.
- **No Alembic migrations for the MVP**: `Base.metadata.create_all()` runs on
  startup. This is simplest-possible for a single-tenant-per-install local
  app with no production migration history yet. Swapping in Alembic later is
  additive, not a rewrite.
- **TF-scored keyword retrieval for the knowledge base, not a vector DB**:
  no extra service to install, works fully offline, and the chunk table
  shape (`KnowledgeChunk`) is already what an embedding-based retriever would
  need -- only `app/services/knowledge_service.py` would change.
- **A JSON-action ReAct loop instead of a provider-specific function-calling
  API**: Ollama model function-calling support varies a lot by model. A
  plain "respond with one JSON object" protocol works across any model the
  user installs, and keeps `LLMProvider` a thin, swappable interface.
