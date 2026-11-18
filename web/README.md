# ARyzz AI Solutions — client platform

Production website and business system for **ARyzz AI Solutions**: a marketing
site that sells website development, AI automation and monthly care plans; a
client portal for quotations, payments and project tracking; and an admin CRM
with revenue tracking and an AI business assistant.

- **Launch steps:** [`docs/LAUNCH_GUIDE.md`](docs/LAUNCH_GUIDE.md)
- **Day-to-day operations:** [`docs/OPERATIONS.md`](docs/OPERATIONS.md)
- **What is live / sandbox / pending:** [`docs/STATUS.md`](docs/STATUS.md)

## Stack

| Concern | Choice |
|---|---|
| App | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| Styling | Tailwind CSS 4 |
| Database, auth, files | Supabase (PostgreSQL + Row Level Security, Auth, private Storage) |
| Payments | Stripe Checkout (cards, FPX, GrabPay), Stripe Billing subscriptions, Customer portal, signed webhooks |
| Email | Resend HTTP API (optional) |
| AI | Anthropic Claude via the official SDK (optional) |
| Hosting | Vercel (or any Node.js host) + daily cron |
| Tests | Vitest (unit + PostgreSQL integration), Playwright smoke test |

## Run locally

```bash
cd web
npm install
cp .env.example .env.local   # fill in what you have; everything is optional for browsing
npm run dev                  # http://localhost:3000
```

Without Supabase keys the public site runs with the built-in catalogue
(`src/content/catalog.json`) and forms explain that the system is being set up.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run typecheck` / `lint` | TypeScript and ESLint |
| `npm test` | Unit tests (payments, auth, AI guardrails, maths, validation) |
| `npm run test:db` | Applies all migrations to a throwaway PostgreSQL DB and tests RLS + payment functions. Needs `TEST_DATABASE_ADMIN_URL=postgres://user:pass@localhost:5432/postgres` (superuser) |
| `npm run test:e2e` | Browser smoke test against the production build (run `npm run build` first) |
| `npm run make-admin -- you@domain` | Promote an existing account to admin (needs service key env vars) |
| `node scripts/generate-seed.mjs` | Regenerate the catalogue seed SQL after editing `src/content/catalog.json` |

## How the money flow stays safe

1. Prices are read from the database on the server — never from the browser.
2. Checkout happens on Stripe's hosted page; card data never reaches this app.
3. An invoice becomes **paid only** when Stripe's signed webhook (verified with
   `STRIPE_WEBHOOK_SECRET`) confirms it, or when an admin records a verified
   bank transfer. The success redirect alone changes nothing.
4. Payment recording runs inside a single database transaction, is idempotent
   per Stripe event and per payment intent, and can only be executed with the
   service role.
5. Row Level Security isolates every client's records; admins are identified by
   a `role` column that users cannot change.
6. Refunds are never automatic — the owner issues them in Stripe and the
   platform records them.

## Project layout

```
web/
  src/app/(marketing)   Public site, legal pages, quote/booking forms, /order checkout start
  src/app/(auth)        Login, register, password reset
  src/app/dashboard     Client portal
  src/app/admin         Admin CRM, finance, AI assistant, settings
  src/app/api           Stripe webhook, AI endpoint, file downloads, cron, health
  src/actions           Server actions (public, auth, client, admin)
  src/lib               Domain logic (money, invoices, booking, metrics, stripe, ai, supabase)
  src/content           Service catalogue, FAQ
  supabase/migrations   Schema, functions, RLS, storage, seed
  tests/                unit, db (PostgreSQL), e2e (Playwright)
  docs/                 Launch guide, operations manual, status
```
