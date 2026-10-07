# Roadmap

This MVP deliberately stops short of several things the product spec
describes as *future* architecture. This file is the honest list of what's
next, in rough priority order.

## Near-term (strengthens the existing MVP)

- **Alembic migrations** -- replace `Base.metadata.create_all()` once the
  schema needs to evolve without losing local data.
- **Vector-based knowledge retrieval** -- swap the TF-scored keyword search
  in `knowledge_service.py` for embeddings (e.g. a local sentence-transformer
  + a lightweight vector index) once the keyword approach's recall becomes a
  problem. The `KnowledgeChunk` schema was designed not to need changes for
  this.
- **OCR for image uploads** -- receipts/documents submitted as photos
  currently return "not extractable" rather than fabricating content; add a
  local OCR engine (e.g. Tesseract) to actually read them.
- **Multi-turn clarification** -- today, an `ask_user` response ends the
  agent run; the user's reply starts a *new* run with no memory of the
  paused question. A proper "continue this run with my answer" endpoint
  would make clarification feel like one conversation.
- **Refresh tokens / session management UI**, password reset flow.
- **PDF export polish** -- configurable templates/branding beyond the
  current fixed layout in `pdf_service.py`.

## Integrations (explicitly out of scope for the MVP per spec section 27)

Interfaces exist or are trivial to add without touching the agent core:
`NotificationProvider` is already an interface with one implementation
(in-app). The same pattern applies to:

- `EmailProvider` -- real outbound email/SMS, so `send_customer_message`
  can actually deliver instead of only recording an outbound interaction.
- `CalendarProvider` -- sync follow-ups/tasks to a calendar.
- `PaymentProvider` -- real payment confirmation instead of a manually
  entered `amount_paid`.
- `AccountingProvider` -- export invoices to an accounting system.
- An **official e-invoicing integration** -- this requires reading that
  government/authority's current official API documentation before writing
  any code; nothing should be invented. Until then, invoices are explicitly
  labeled as internal drafts, not legally compliant e-invoices.

## Agent Core as a platform (spec section 59)

The MVP already separates `LLMProvider`, the tool registry, the orchestrator,
and `Approval`/`AuditLog` as reusable pieces. Building a second specialized
agent (e.g. a "Marketing Agent") should mean: a new tool module + a narrower
system prompt, reusing the same orchestrator, policy engine, and approval
center -- not a parallel implementation.

## Hosted LLM providers

`LLMProvider` (`app/agent/llm_provider.py`) has one implementation today
(`OllamaProvider`) plus a `NullProvider` fallback. Adding
`AnthropicProvider` / `OpenAIProvider` is additive: implement `generate()`
and `is_available()`, wire it into `get_llm_provider()`'s provider-name
switch, and read the API key from an environment variable (never commit it).

## Explicitly deferred (per spec section 60 -- don't overengineer)

No plans to add: multiple AI personas, animated avatars, blockchain/crypto,
gamification, or a generic enterprise-ERP-style mega-dashboard. The product
goal stays "a serious operations tool with one competent AI employee," not a
demo of unrelated features.
