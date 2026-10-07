# Database

SQLite for the MVP (`DATABASE_URL=sqlite:///./data/app.db`), accessed only
through SQLAlchemy models in `backend/app/models/`. Every table uses a UUID
(`String(36)`) primary key (`app/models/base.py::new_uuid`) and
`created_at`/`updated_at` timestamps consistently.

Tables are created via `Base.metadata.create_all()` at application startup
(`app/main.py` lifespan handler) -- there is no separate migration step to
run for the MVP. If you change a model after the database file already
exists, either delete `backend/data/app.db` (dev only -- destroys data) or
add a proper Alembic migration before shipping real user data (see
`docs/ROADMAP.md`).

## Entity summary

| Table | Purpose | Key relationships |
|---|---|---|
| `users` | login identity | has many `business_members` |
| `businesses` | a tenant; holds settings, autonomy level, tax config, numbering sequences | has many members, customers, leads, ... |
| `business_members` | user <-> business with a role (`OWNER`/`ADMIN`/`USER`) | links `users` + `businesses` |
| `customers` | CRM customer | has many `contacts`, `leads` |
| `contacts` | a person at a customer | belongs to `customers` |
| `leads` | sales pipeline entry (`NEW`→...→`WON`/`LOST`) | belongs to `customers`, has many `interactions` |
| `interactions` | a logged touch point (note/email/call/message); **untrusted external content lives here as plain data** | belongs to `customers`/`leads` |
| `tasks` | internal to-dos, can link to a customer/lead | - |
| `follow_ups` | scheduled reminders with trigger/due dates and an outcome | links `customers`/`leads`/`quotations` |
| `services` | reusable catalog entry (name + default price) | - |
| `quotations` / `quotation_items` | DRAFT→...→ACCEPTED/REJECTED/EXPIRED; number unique **per business** | belongs to `customers`/`leads` |
| `invoices` / `invoice_items` | DRAFT→...→PAID/CANCELLED; number unique **per business** | belongs to `customers`, optional `quotations` |
| `documents` | uploaded file + extracted text/fields + confidence + `needs_review` | optional link to `customers` |
| `knowledge_documents` / `knowledge_chunks` | business knowledge source + its retrievable chunks | optional link to `documents` |
| `business_rules` | structured business memory: `kind` (FACT/PREFERENCE/RULE/ASSUMPTION), `confirmed` flag | - |
| `agent_runs` / `agent_messages` / `tool_executions` | one row per agent run, its reasoning trace, and every tool call it made | - |
| `approvals` | a pending/decided high-impact action, with the data the agent used, expected result, and risk level | optional link to `agent_runs` |
| `notifications` | in-app notification | - |
| `audit_logs` | immutable record of every meaningful action, by user or agent | optional link to `agent_runs` |

## Design notes

- **`business_id` on every operational row**: this is how row-level
  multi-tenancy is enforced -- every query a router or tool makes filters on
  the authenticated caller's resolved business.
- **Quotation/invoice numbering**: `Business.next_quotation_sequence` /
  `next_invoice_sequence` are simple per-business counters
  (`app/services/numbering_service.py`), incremented transactionally when a
  number is issued. The `(business_id, number)` unique constraint is the
  real integrity guarantee, not just the counter.
- **`BusinessRule.confirmed`**: an agent-proposed rule that would overwrite
  an already-confirmed one is stored as a *separate* unconfirmed suggestion
  (key suffixed `__suggested`) instead of silently replacing it --
  implemented in `app/services/business_rule_service.py::upsert_rule`.
- **`ToolExecution.required_approval` + `Approval.id`**: this is how a
  paused agent run finds "the tool call it was waiting on" when resuming --
  see `docs/AGENT.md`.

## Backups

SQLite is a single file, so backups are a file copy. See
`scripts/backup_db.sh` / `scripts/restore_db.sh` (uses `sqlite3 .backup` when
available, for a consistent snapshot even if the server is running; falls
back to a plain file copy otherwise). Back up `backend/data/app.db` and
`backend/uploads/` together -- documents reference files on disk by path, not
by storing file contents in the database.
