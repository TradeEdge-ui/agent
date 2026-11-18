# Operations manual — running ARyzz day to day

Everything here happens in **/admin** after you sign in. The platform automates
paperwork; it never makes money decisions for you.

## The sales workflow

```
Visitor ─► Quote request / booking / contact ─► Lead
Lead ─► (AI qualify, optional) ─► Quotation draft ─► you review ─► Send
Client accepts online ─► Project + invoice schedule created automatically
Client pays deposit (Stripe, verified by webhook) or you record a bank transfer
Project moves to Planning ─► milestones, updates, files, revisions
Final invoice issued by you at completion ─► paid ─► launch
Offer a monthly care plan ─► recurring revenue
```

Faster path: packages marked **"Buy online"** (Starter Website by default) skip
the quotation — the client pays the deposit straight away and the project is
created for you.

## Leads (Admin → Leads)

- Every form submission, booking and client request becomes a lead and appears
  on the overview. You also get an email if `ADMIN_NOTIFICATION_EMAIL` is set.
- Move leads through the pipeline: new → contacted → qualified → proposal sent
  → won / lost. Private notes are never visible to the client.
- **Qualify with AI** gives an advisory score, budget fit, red flags and the
  questions to ask. Click **Save to lead** only if you agree with it.
- **Add a lead manually** for WhatsApp/phone/walk-in enquiries.

## Quotations (Admin → Quotations)

1. **Create quotation** from a lead (pre-fills client and package), from
   scratch, or **AI quote draft** → **Open in quotation editor**.
2. Edit line items (RM), discount, SST (only if registered), deliverables,
   exclusions, revisions, timeline, validity and the **payment schedule**
   (must total 100%, e.g. 50/50 or 30/40/30).
3. **Save draft** — nothing is sent. Review it, then **Send to client**.
   - If the client has an account, they get an in-app + email notification.
   - If not, they get an email inviting them to register with that address;
     the quote attaches to their account automatically once they verify email.
4. When the client accepts: the project and all instalment invoices are
   created. The first instalment is issued immediately; later ones are
   **drafts you issue** when each milestone is reached.
5. Need changes after sending? **Duplicate** the quote, edit, send the new one,
   and **Cancel** the old one. Expired quotes are closed automatically each day.

## Projects (Admin → Projects)

- Status, progress %, start date and **target date** (only set a date you
  commit to — clients see it), staging and live URLs.
- **Milestones**: add them at kick-off; marking one complete updates the
  progress bar and notifies the client.
- **Updates**: post progress notes (client is notified) or tick *Internal note*.
  **Draft update (AI)** writes a first version for you to edit.
- **Revision requests**: respond, change status, and decide whether a request
  counts toward the included rounds. Extra rounds → issue a manual invoice.
- **Deliver a file** uploads to the client's private folder and notifies them.

## Getting paid

- **Online**: clients click **Pay now** on any open invoice → Stripe Checkout
  (card, FPX, GrabPay as enabled). An invoice is marked paid **only** after
  Stripe's signed webhook confirms it.
- **Bank transfer / DuitNow**: when the money is in your bank, open the
  invoice → **Record bank transfer** with the reference. A receipt is issued.
- **Reminders**: overdue invoices get an automatic gentle reminder at most
  every 3 days (toggle in Settings), or click **Send reminder**.
- **Void** an unpaid invoice that was issued by mistake.
- **Refunds**: decide on the refund yourself, then issue it in the Stripe
  dashboard (Payments → the payment → Refund). The platform records it
  automatically. For bank-transfer refunds, transfer the money and add an
  expense/note — the platform cannot move money.
- **Extra work**: Admin → Invoices → **New invoice** (e.g. change requests).

## Monthly care plans (Admin → Subscriptions)

- Clients subscribe from `/order/<plan>` or their dashboard. Stripe charges the
  card monthly and the platform records each paid invoice and receipt.
- Clients can cancel (effective end of period) or undo cancellation, and update
  their card via **Manage payment method & invoices** (Stripe portal).
- Failed renewals show as **past due**; the client and you are notified.
- To change the price of an existing subscriber, do it in Stripe and give the
  client 30 days' notice (your Terms promise this). New prices you set in
  Services apply to new subscriptions only.

## Pricing & packages (Admin → Services & pricing)

- Edit names, descriptions, price ranges, deposit %, deliverables, exclusions,
  revision limits, timeline, visibility and "featured" flag.
- **How customers buy**: *Request a quotation* or *Buy/subscribe online at base
  price*. Only use "buy online" when the base price covers a clearly defined
  scope.
- Changes show on the website within about 5 minutes.

## Money overview (Admin → Overview, Revenue & expenses)

- Revenue is counted when a payment is verified (cash basis), net of refunds.
- Record every business cost as an **expense** (software, hosting, AI usage,
  Stripe fees, ads, contractors) so profit is accurate. Stripe fees are
  deducted from payouts — copy them from Stripe's balance report monthly.
- MRR = active care-plan subscriptions.

## Consultations (Admin → Consultations, Settings)

- Set working days, hours, slot length, minimum notice and blocked dates
  (public holidays, leave) in **Settings**.
- For each booking, paste a Google Meet/Zoom link and tick **Email client**.
  Mark completed or no-show afterwards.

## Portfolio & testimonials

- Add only work you delivered. Named client projects require the client's
  permission (the form asks you to confirm).
- Clients can submit testimonials from their profile after a project is
  completed, with an explicit consent checkbox. You publish them; the database
  refuses to publish any testimonial without recorded consent.

## AI assistant (Admin → AI assistant)

Tasks: qualify lead, draft quotation, summarise requirements, project plan,
structure & tech recommendation, client update, follow-up email/WhatsApp,
upsell ideas, and free-form questions (including coding help).

Guardrails built in:
- It has **no tools**: it can only return text. It cannot send messages,
  change prices, invoices or billing, approve spending, issue refunds or
  publish websites.
- Client-written text is wrapped as untrusted data, so instructions hidden in
  a lead's message are ignored.
- Every request is logged (task, record, tokens) at the bottom of the page.
- Client-facing drafts use placeholders like `[CONFIRM DATE]` instead of
  inventing commitments.

## Daily automation (09:00 MYT)

- Expires quotations past their validity date.
- Sends overdue-invoice reminders (if enabled).
- Emails you a digest: new leads, upcoming consultations, outstanding balance.

## Housekeeping checklist

- **Weekly**: clear new leads, follow up sent quotes, check overdue invoices.
- **Monthly**: record expenses and Stripe fees, review MRR and profit, ask
  completed clients for testimonials, check Supabase/Stripe/Anthropic usage.
- **Before changing prices**: decide in Services; tell existing subscribers.
- **Backups**: Supabase Pro includes daily backups. On the free plan, export
  periodically (Supabase → Database → Backups / `pg_dump`).
