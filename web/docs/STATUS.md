# Platform status — what is live, sandboxed, or waiting on you

_Last updated: 17 November 2026_

## Summary

The platform is **fully built and tested in code**. It is **not deployed yet**
and **no external accounts are connected**, because those require your
identity, business documents and credentials. Nothing below claims a
deployment, a live payment or a connected service that has not happened.

| Area | Status | What is needed |
|---|---|---|
| Marketing website (home, services, pricing, portfolio, about, contact, FAQ, legal) | ✅ Built, production build passes, browser-tested | Deploy (Launch guide §5) |
| Quote request, contact and booking forms | ✅ Built and tested; degrade gracefully without a database | Supabase (§1) |
| Accounts: register, email confirmation, login, password reset | ✅ Built and unit-tested against the Supabase Auth API contract | Supabase project + auth URL settings (§1.4) |
| Client dashboard (quotes, projects, invoices, receipts, care plans, files, revisions, bookings, notifications, testimonial) | ✅ Built | Supabase |
| Admin CRM (leads, clients, quotations, invoices, projects, subscriptions, finance, bookings, services/pricing, portfolio, testimonials, notifications, settings) | ✅ Built | Supabase + make yourself admin (§6) |
| Database schema, Row Level Security, payment functions | ✅ Applied to a real PostgreSQL 16 in tests (26 integration tests) | Apply migrations to your Supabase project (§1.2) |
| Stripe one-time payments (deposits, milestones, full) | 🧪 Code complete; webhook signature verification tested with Stripe's own library; **not yet run against a Stripe account** | Stripe account, test keys, webhook (§2) → run the test checklist (§7) |
| Stripe subscriptions, cancellation, customer portal | 🧪 Code complete and unit-tested with simulated Stripe objects | Same as above + Customer portal settings (§2.3) |
| Refund recording | 🧪 Tested at database level; refunds are issued manually by you in Stripe | Stripe |
| Bank transfer / DuitNow recording | ✅ Works once the database is connected (admin-only, tested) | Supabase |
| Transactional email | 🧪 Code complete (Resend HTTP API); skipped and logged when unconfigured | Resend account + verified domain (§3) |
| AI business assistant | 🧪 Code complete; guardrails unit-tested; **no live API call made** (no key) | Anthropic API key (§4) |
| Daily automation (quote expiry, reminders, digest) | ✅ Built; secured with `CRON_SECRET` | Vercel deploy + `CRON_SECRET` |
| Hosting | ⏳ Not deployed | Vercel Pro (Hobby is non-commercial) or another Node host (§5) |
| Live payments | ⏳ Not enabled | Stripe account activation, live keys (§8) |

Legend: ✅ working and verified · 🧪 implemented and tested in isolation, needs your sandbox account to verify end-to-end · ⏳ requires your action.

## Test results (run in this environment)

| Suite | Command | Result |
|---|---|---|
| Unit tests: money, invoice maths, booking slots, metrics, validation, open-redirect protection, Stripe checkout params, webhook reconciliation, **webhook route with real Stripe signature verification** (valid, unsigned, wrong secret, tampered body), auth flows, AI guardrails | `npm test` | **48 / 48 passed** |
| Database integration: migrations on PostgreSQL 16 with Supabase role emulation; RLS isolation between clients; anti-self-promotion to admin; quote acceptance and invoice schedules (rounding, SST split, expiry, double acceptance); direct orders priced from DB; **idempotent payment recording** (duplicate events and duplicate payment intents ignored); service-role-only payment functions; refunds; subscription sync and invoice idempotency; double-booking prevention; storage folder isolation; testimonial consent; rate limiting | `npm run test:db` | **26 / 26 passed** |
| Browser smoke test on the production build (desktop + iPhone 13): all public pages, catalogue prices, protected-route redirects, graceful forms, health/webhook/cron protections, robots/sitemap, security headers, 404, JSON-LD, no horizontal overflow on mobile, mobile menu, no console errors | `npm run build && npm run test:e2e` | **38 / 38 passed** |
| TypeScript, ESLint, `next build` | `npm run typecheck && npm run lint && npm run build` | Clean |

Not tested here (needs your accounts): a real Stripe test-mode checkout, real
Supabase Auth emails, real Resend delivery and real Claude responses. Section 7
of the launch guide is the checklist for that.

## Payment gateway evaluation (why Stripe)

| | Stripe Malaysia | Local gateways (e.g. Billplz, CHIP, ToyyibPay, HitPay) |
|---|---|---|
| Sole proprietor eligible | Yes, per Stripe's Malaysia services agreement | Generally yes |
| Cards + FPX + e-wallets | Cards, FPX, GrabPay | FPX strong; card/e-wallet support varies |
| Recurring subscriptions with self-service cancel | Yes (Billing + Customer portal) | Limited / varies by provider |
| Hosted checkout (no card data on our servers) | Yes | Yes |
| Signed webhooks + sandbox | Yes | Varies |
| Indicative fees | Commonly cited ~3% + RM1 per domestic card/FPX transaction, plus Stripe Billing fee on subscriptions | Often cheaper for FPX (flat RM1–1.50 or ~1–2%) |

**Decision:** Stripe, because it is the only option here that covers one-time
payments, deposits, recurring care plans, self-service cancellation, invoices
and receipts with one well-documented, testable API. If FPX fees become
significant, a local gateway can be added later for one-time invoices only (the
payment-recording function `apply_payment` is provider-agnostic).
**Confirm current fees at stripe.com/my/pricing before launch.**

Example (indicative): a RM399.50 Starter deposit ≈ RM13 in fees; a RM99 care
plan ≈ RM4–5 per month including the Billing fee.

## Compliance notes (not legal advice)

- **SST**: off by default. Turn it on in Settings only once registered with
  RMCD; it then applies to new quotes, orders and invoices.
- **e-Invoicing (LHDN MyInvois)**: current reporting indicates businesses below
  an annual turnover threshold (RM1 million from 2026, with a further increase
  reported) are exempt. Verify on the LHDN site. Invoices generated here are
  business invoices, not MyInvois e-invoices; an integration would be needed
  if you exceed the threshold.
- **PDPA 2010**: the Privacy Policy describes data use, processors and rights.
  Have the legal pages reviewed by a lawyer before relying on them.
- **Honest marketing**: no fake reviews, logos or portfolio items are included;
  testimonials cannot be published without recorded consent (enforced by the
  database).

## Business decisions for you (defaults chosen, change anytime)

1. **Prices** — seeded exactly as you specified; review against your costs.
2. **Starter Website is "buy online"** at RM799 with a 50% deposit; everything
   else (except care plans) is quote-first. Toggle per package in Admin.
3. **Refund policy** — full deposit refund before work starts; non-refundable
   after work starts; care plans cancel at period end. Edit
   `src/app/(marketing)/legal/refund/page.tsx` if you want different terms.
4. **Response-time wording** — the site says you "aim to reply within one
   business day" and lists Mon–Fri 9am–6pm hours. Adjust in the contact page
   and emails if that is not realistic for you.
5. **AI model** — `claude-opus-5-5` by default; `claude-haiku-5-5` is far
   cheaper for routine drafting.

## Monthly running cost (indicative)

| Item | Start | When you grow |
|---|---|---|
| Vercel | Pro, ~USD 20 (Hobby is non-commercial) | same |
| Supabase | Free | Pro ~USD 25 (no pausing, daily backups) |
| Stripe | No monthly fee, per-transaction only | same |
| Resend | Free tier (verify current quota) | paid tier if volume grows |
| Anthropic | Pay per use (cents per request) | set a spend cap |
| Domain | ~RM50–150 / year | same |

## Recommended next steps after launch

1. Run the Stripe test checklist, then go live (Launch guide §7–8).
2. Offer the first clients a clear reason to buy now (your decision — e.g. a
   founding-client portfolio slot in exchange for a testimonial).
3. Turn on Google Search Console with your domain and submit `/sitemap.xml`.
4. Add a Cloudflare Turnstile captcha to public forms if spam appears.
5. Consider a local FPX gateway only if FPX volume makes fees material.
