# Security

## Authentication

- Passwords hashed with bcrypt via `passlib` (`app/security/passwords.py`).
  Never stored or logged in plain text.
- Sessions are stateless signed JWTs (`app/security/tokens.py`), `HS256`,
  expiring after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 24h). The signing
  key is `SECRET_KEY`, read from the environment -- never hardcoded, never
  committed (`.env` is gitignored; `.env.example` has placeholder values
  only).
- `OAuth2PasswordBearer` extracts the bearer token; `get_current_user`
  (`app/api/deps.py`) resolves and validates it on every request.

## Authorization (server-side, not trusted to the frontend)

- Every business-scoped endpoint depends on `get_current_business`, which
  looks up the caller's `BusinessMember` row and raises `403`/`404` rather
  than trusting a client-supplied business id. A user can only ever see
  businesses they are an explicit member of.
- Three roles: `OWNER > ADMIN > USER` (`ROLE_RANK` in `app/api/deps.py`).
  `require_role("ADMIN")` is used on endpoints that change business-wide
  settings (e.g. `PATCH /api/business`). Role checks happen in the
  dependency graph, so a route cannot be reached without passing them --
  there is no way to "forget" the check per-endpoint.
- The agent cannot approve or reject its own high-risk actions --
  `approve_action`/`reject_action` are deliberately **not** tools the LLM
  can call; they only exist as authenticated user-facing API endpoints.

## Input validation

- All request bodies are Pydantic schemas (`app/schemas/*`) -- FastAPI
  rejects malformed input before a route body ever runs.
- All agent tool inputs are Pydantic schemas too (`app/tools/*`), validated
  before any handler executes, independent of HTTP-layer validation.
- File uploads: extension allowlist (`ALLOWED_EXTENSIONS` in
  `document_service.py`), size cap (`MAX_UPLOAD_SIZE_MB`), and files are
  written under a per-business UUID-named path inside `UPLOAD_DIR` --
  never using the client-supplied filename as a path.

## SQL injection

All database access goes through SQLAlchemy's ORM query builder with bound
parameters (`db.query(...).filter(...)`) -- no string-interpolated SQL
anywhere in the codebase.

## Error handling

- A global exception handler (`app/main.py`) catches any unhandled
  exception, logs the full traceback server-side, and returns a generic
  `{"detail": "An internal server error occurred."}` -- stack traces are
  never sent to the client.
- Tool handlers catch unexpected exceptions the same way (`orchestrator.py
  _execute_tool`): the real error is logged, the agent/user sees a generic,
  honest "an internal error occurred" message rather than raw internals.

## Multi-tenancy data isolation

Every operational table (`Customer`, `Lead`, `Task`, `Quotation`, ...) has a
`business_id` foreign key, and every query filters on it via the
authenticated caller's resolved business. Quotation/invoice numbers are
uniquely constrained **per business** (`UniqueConstraint("business_id",
"number")`), not globally -- so two different businesses can both have a
"QT-0001" without colliding (this was caught and fixed during
development/testing of this MVP).

## Prompt injection / untrusted content

See `docs/AGENT.md`'s "Prompt injection defense" section. In short: content
that originates outside the system (pasted customer messages, uploaded
document text, knowledge-base chunks) is only ever injected into the model
conversation as labelled tool-result data, never as instructions, and the
system prompt explicitly tells the model to treat it that way.

## Rate limiting

Not implemented in the MVP (no reverse proxy / gateway layer is assumed for
local single-user use). If deployed beyond a single local user, add rate
limiting at a reverse proxy (e.g. nginx, Caddy) in front of the FastAPI app
rather than inside it, to keep the application layer simple.

## Known limitations (be honest about what this MVP does NOT do)

- No email verification or password-reset flow.
- No refresh-token rotation (the JWT simply expires; re-login is required).
- No CSRF protection layer -- acceptable because the API uses bearer tokens
  in an `Authorization` header (not cookies), which are not subject to
  classic CSRF.
- No per-tool rate limiting for the agent beyond the iteration/timeout caps.
- Uploaded files are stored unencrypted on local disk under `backend/uploads/`.
