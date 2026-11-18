# Launch guide — from code to first paying client

This is the exact sequence to take the ARyzz platform live. Everything in the
repository is built and tested; the steps below are the parts that need **your
accounts, your identity documents or your decisions**, which cannot be done
for you.

Estimated time: 2–3 hours of setup, plus Stripe's account review (often same
day, sometimes a few business days).

---

## 0. What you need before you start

| Item | Why | Cost |
|---|---|---|
| SSM registration (sole proprietor via ezBiz, or Sdn Bhd) | Stripe Malaysia needs a registered business or sole proprietor, a Malaysian bank account and your IC | Sole prop. registration fee per SSM |
| Malaysian business bank account | Stripe payouts | — |
| A domain (e.g. `aryzz.my` or `aryzzai.com`) | Professional email + website | ~RM50–150 / year |
| GitHub account (you have this repo) | Vercel deploys from it | Free |

Check current requirements and fees directly with each provider — they
change, and this guide does not replace their terms.

---

## 1. Supabase (database, login, file storage)

1. Create an account at <https://supabase.com> → **New project**.
   - Region: **Southeast Asia (Singapore)** for the lowest latency in Malaysia.
   - Save the database password somewhere safe (password manager).
2. **Apply the database schema.** Open **SQL Editor → New query**, then paste
   and run each file from `web/supabase/migrations/` **in order**:
   1. `20261117000001_schema.sql`
   2. `20261117000002_functions.sql`
   3. `20261117000003_rls.sql`
   4. `20261117000004_storage.sql`
   5. `20261117000005_seed.sql` (the starting service catalogue and prices)

   Each should finish with "Success. No rows returned".
   *(Alternative for CLI users: `npx supabase login`, `npx supabase link --project-ref <ref>`,
   `npx supabase db push` from the `web/` folder.)*
3. **Copy your keys** from **Project Settings → API Keys**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable key (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Secret key (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (**server only — never share it**)
4. **Authentication → URL Configuration**
   - Site URL: `https://<your-domain>`
   - Redirect URLs: add `https://<your-domain>/auth/callback`,
     `https://<your-domain>/auth/confirm` and, for local testing,
     `http://localhost:3000/**`.
5. **Authentication → Providers → Email**: keep **Confirm email** ON. Set the
   minimum password length to **10** (matches the app's rule).
6. **Authentication → Emails → SMTP Settings** (strongly recommended): the
   built-in sender is heavily rate-limited and not meant for production. Use
   Resend's SMTP once step 4 is done: host `smtp.resend.com`, port `465`,
   username `resend`, password = your Resend API key, sender = your verified
   address.
7. *(Optional, more robust email links)* In **Authentication → Emails →
   Templates**, change the confirmation link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
   and the password-reset link to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`.
   This works even if the client opens the email on a different device.

> Free plan note: Supabase pauses free projects with too little activity over
> a week. The platform's daily automation queries the database every day,
> which normally keeps it active, but upgrade to Pro (USD 25/month) once you
> have regular clients so the site can never be paused.

---

## 2. Stripe (payments) — start in TEST mode

1. Create an account at <https://dashboard.stripe.com/register>, country
   **Malaysia**. Complete **Activate payments** with your SSM details, IC and
   bank account. Until approved you can still use **test mode**.
2. **Settings → Payment methods**: turn on **Cards**, **FPX** and (optional)
   **GrabPay**. The code never hard-codes payment methods — Stripe shows the
   ones you enable. Subscriptions automatically use card only (FPX is not a
   recurring method).
3. **Settings → Billing → Customer portal**: click **Activate**/save, and
   allow: update payment methods, view invoice history, cancel subscriptions
   (at end of billing period). Save it in **test mode and again in live mode**.
4. **Settings → Business → Public details / Customer emails**: set your public
   business name, support email and enable **successful payment receipts** so
   Stripe also emails clients a receipt.
5. **Developers → API keys** → copy the **Secret key** (`sk_test_…`) →
   `STRIPE_SECRET_KEY`.
6. **Developers → Webhooks → Add endpoint** (after you have a URL from step 5):
   - Endpoint URL: `https://<your-domain>/api/stripe/webhook`
   - API version: choose the newest offered (the SDK is pinned to `2026-10-28.endive`; the handler re-reads objects from the API, so it tolerates version differences).
   - Events to send:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `charge.refunded`
   - Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.

---

## 3. Resend (transactional email) — recommended

1. <https://resend.com> → add and **verify your domain** (DNS records at your
   domain registrar).
2. Create an API key → `RESEND_API_KEY`.
3. `EMAIL_FROM="ARyzz AI Solutions <hello@your-domain>"`
4. `ADMIN_NOTIFICATION_EMAIL=` the inbox where you want new-lead, payment and
   daily-digest alerts.

Without Resend the platform still works: every notification is stored in the
dashboards, but nothing is emailed.

---

## 4. Anthropic (AI assistant) — optional

1. <https://console.anthropic.com> → create an API key → `ANTHROPIC_API_KEY`.
2. Set a monthly spend limit in the console.
3. Default model is `claude-opus-5-5` (best quality, about USD 4 / 20 per
   million input/output tokens — roughly a few US cents per assistant request).
   For much lower cost set `ANTHROPIC_MODEL=claude-haiku-5-5`.

---

## 5. Vercel (hosting)

> **Plan:** Vercel's free Hobby plan is for **personal, non-commercial use
> only**. A business website that sells services requires **Vercel Pro**
> (USD 20/month per member at the time of writing). If you prefer another
> host, the app is a standard Next.js 16 Node.js application.

1. <https://vercel.com/new> → **Import** this GitHub repository.
2. **Root Directory: `web`** (important — the repository also contains the
   older prototype). Framework: Next.js (auto-detected).
3. Add **Environment Variables** (all of them from `web/.env.example`):
   `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
   `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAIL`, `ANTHROPIC_API_KEY`,
   `ANTHROPIC_MODEL`, `CRON_SECRET` (generate with `openssl rand -hex 32`).
4. **Deploy.** Then **Settings → Domains** → add your domain and follow the
   DNS instructions. Set `NEXT_PUBLIC_SITE_URL` to the final `https://` domain
   and **redeploy**.
5. The daily automation (`web/vercel.json`) runs at 09:00 Malaysia time. Vercel
   sends `CRON_SECRET` automatically.
6. Create the Stripe webhook (step 2.6) now that the URL exists, add its
   secret to Vercel, and redeploy.

---

## 6. Make yourself the admin

1. On your live site, click **Client login → Create an account**, use your
   business email, confirm it from your inbox.
2. In Supabase **SQL Editor** run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@your-domain';
   ```
   (or locally: `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… npm run make-admin -- you@your-domain`)
3. Sign out and in again → you land on `/admin`.
4. **Admin → Settings**: fill in business name, SSM number, email, phone,
   WhatsApp, address, bank details / DuitNow, and consultation hours. These
   appear on the website, invoices and receipts.
5. **Admin → Services & pricing**: review every package, price, deliverable
   and exclusion. The starting prices are suggestions — adjust them to your
   costs and market.

---

## 7. Test the money flow end-to-end (still in Stripe TEST mode)

Use a second email address as a pretend client.

| # | Do this | Expect |
|---|---|---|
| 1 | As the client, open `/order/starter-website`, tick the terms, pay | Stripe Checkout opens with RM399.50 |
| 2 | Pay with card `4242 4242 4242 4242`, any future date, any CVC | Redirect back says "waiting for confirmation", then **Paid** within seconds |
| 3 | Check `/dashboard/invoices` | Invoice paid + receipt `RCT-…` listed |
| 4 | Admin → Projects | Project moved to **Planning**; admin notification received |
| 5 | Pay another test invoice with **FPX** test bank | Same result |
| 6 | Card `4000 0000 0000 0002` (declined) | Invoice stays **Open**, nothing recorded |
| 7 | Client → Care plans → subscribe to Basic | Plan appears **Active**; admin MRR updates |
| 8 | Client → Cancel plan | Shows "Ends on …"; admin notified |
| 9 | Stripe dashboard → refund the test payment | Receipt shows refunded; admin + client notified |
| 10 | Admin → Leads: submit `/get-quote` as a visitor, create a quotation, send it, accept it as the client | Deposit invoice created automatically |
| 11 | Admin → invoice → **Record bank transfer** | Invoice paid, receipt issued |
| 12 | Book a consultation at `/book` | Confirmation email with calendar invite |

Stripe also lets you resend any event from **Developers → Webhooks → (endpoint) → Event deliveries** to check idempotency — duplicates are ignored.

---

## 8. Go live

1. Stripe account **activated** (charges enabled, payouts enabled).
2. In Stripe switch to **Live mode**: copy the live `sk_live_…` key, create the
   **same webhook endpoint in live mode** (new `whsec_…`), and save the
   Customer portal settings in live mode.
3. Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Vercel → redeploy.
4. Admin → Settings → Integrations should show **Stripe — live mode**.
5. Make one small real payment yourself (e.g. a RM5 manual invoice to your own
   client account), confirm it arrives, then refund it.
6. Have a lawyer review the Terms, Privacy and Refund pages (`/legal/*`) — they
   are reasonable starting drafts, not legal advice.

You are now able to take real orders.
