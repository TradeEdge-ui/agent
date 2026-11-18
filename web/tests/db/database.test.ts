/**
 * Integration tests that run the real migrations against PostgreSQL and
 * exercise RLS policies and the money-moving functions.
 *
 * Run with: TEST_DATABASE_ADMIN_URL=postgres://user:pass@localhost:5432/postgres npm run test:db
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_URL, TestDb, createTestDatabase } from "./helpers";

const run = ADMIN_URL ? describe : describe.skip;

run("database: schema, RLS and business functions", () => {
  let db: TestDb;
  let drop: () => Promise<void>;
  let admin: string;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    const created = await createTestDatabase();
    drop = created.drop;
    db = await TestDb.connect(created.url);
    admin = await db.createUser("owner@aryzz.test", { admin: true });
    alice = await db.createUser("alice@client.test", { fullName: "Alice Tan" });
    bob = await db.createUser("bob@client.test", { fullName: "Bob Lim" });
  }, 60_000);

  afterAll(async () => {
    await db?.end();
    await drop?.();
  });

  async function createSentQuote(clientId: string | null, email: string, overrides: Record<string, unknown> = {}) {
    const q = {
      title: "Business Website",
      subtotal: 300000,
      discount: 0,
      taxRate: 0,
      tax: 0,
      schedule: [
        { label: "Deposit", percent: 50 },
        { label: "Final payment", percent: 50 },
      ],
      validUntil: "2099-01-01",
      ...overrides,
    } as {
      title: string; subtotal: number; discount: number; taxRate: number; tax: number;
      schedule: unknown; validUntil: string;
    };
    const total = q.subtotal - q.discount + q.tax;
    const rows = await db.as<{ id: string; number: string }>(
      "authenticated",
      admin,
      `insert into public.quotes (client_id, client_email, client_name, title, line_items, subtotal_cents, discount_cents,
         tax_rate, tax_cents, total_cents, payment_schedule, valid_until, status, sent_at)
       values ($1, $2, 'Client', $3, $4, $5, $6, $7, $8, $9, $10, $11, 'sent', now()) returning id, number`,
      [clientId, email, q.title, JSON.stringify([{ description: q.title, quantity: 1, unit_price_cents: q.subtotal }]),
        q.subtotal, q.discount, q.taxRate, q.tax, total, JSON.stringify(q.schedule), q.validUntil],
    );
    return rows[0];
  }

  describe("signup and account linking", () => {
    it("creates a client profile for every new auth user", async () => {
      const rows = await db.asSuper<{ role: string; full_name: string }>(
        "select role, full_name from public.profiles where id = $1", [alice]);
      expect(rows[0]).toEqual({ role: "client", full_name: "Alice Tan" });
    });

    it("links earlier leads and quotes to the account only after email confirmation", async () => {
      await db.asSuper(
        "insert into public.leads (name, email, message) values ('Carol', 'carol@client.test', 'Need a site')");
      await db.asSuper(
        `insert into public.quotes (client_email, title, subtotal_cents, total_cents, status)
         values ('carol@client.test', 'Starter', 79900, 79900, 'sent')`);
      const carol = await db.createUser("Carol@Client.test", { confirmed: false });
      let linked = await db.asSuper<{ n: number }>(
        "select count(*)::int as n from public.leads where user_id = $1", [carol]);
      expect(linked[0].n).toBe(0);

      await db.asSuper("update auth.users set email_confirmed_at = now() where id = $1", [carol]);
      linked = await db.asSuper<{ n: number }>("select count(*)::int as n from public.leads where user_id = $1", [carol]);
      expect(linked[0].n).toBe(1);
      const quotes = await db.asSuper<{ n: number }>(
        "select count(*)::int as n from public.quotes where client_id = $1", [carol]);
      expect(quotes[0].n).toBe(1);
    });

    it("prevents users from promoting themselves to admin", async () => {
      await expect(
        db.as("authenticated", alice, "update public.profiles set role = 'admin' where id = $1", [alice]),
      ).rejects.toThrow(/permission denied/);
      const ok = await db.as<{ full_name: string }>(
        "authenticated", alice, "update public.profiles set full_name = 'Alice T.' where id = $1 returning full_name", [alice]);
      expect(ok[0].full_name).toBe("Alice T.");
    });

    it("hides other users' profiles", async () => {
      const rows = await db.as("authenticated", alice, "select id from public.profiles where id = $1", [bob]);
      expect(rows).toHaveLength(0);
    });
  });

  describe("catalogue visibility", () => {
    it("seeds the default catalogue and shows active services to anonymous visitors", async () => {
      const rows = await db.as<{ n: number }>("anon", null, "select count(*)::int as n from public.services");
      expect(rows[0].n).toBe(11);
    });

    it("hides inactive services from the public but not from admins", async () => {
      await db.asSuper("update public.services set is_active = false where slug = 'custom-ai-agent'");
      const anon = await db.as("anon", null, "select id from public.services where slug = 'custom-ai-agent'");
      expect(anon).toHaveLength(0);
      const adm = await db.as("authenticated", admin, "select id from public.services where slug = 'custom-ai-agent'");
      expect(adm).toHaveLength(1);
      await db.asSuper("update public.services set is_active = true where slug = 'custom-ai-agent'");
    });

    it("does not let clients edit prices", async () => {
      const rows = await db.as("authenticated", alice,
        "update public.services set price_min_cents = 100 where slug = 'starter-website' returning id");
      expect(rows).toHaveLength(0);
    });

    it("does not expose leads to anonymous visitors", async () => {
      const rows = await db.as("anon", null, "select * from public.leads");
      expect(rows).toHaveLength(0);
    });
  });

  describe("quotation acceptance", () => {
    it("creates a project and an invoice schedule that sums exactly to the quote total", async () => {
      const quote = await createSentQuote(alice, "alice@client.test", {
        subtotal: 100001, // odd amount to exercise rounding
        schedule: [
          { label: "Deposit", percent: 30 },
          { label: "Design approved", percent: 30 },
          { label: "Launch", percent: 40 },
        ],
      });
      const [res] = await db.as<{ r: { project_id: string; invoice_id: string } }>(
        "authenticated", alice, "select public.accept_quote($1) as r", [quote.id]);
      const invoices = await db.as<{ total_cents: string; status: string; kind: string; sequence: number }>(
        "authenticated", admin,
        "select total_cents, status, kind, sequence from public.invoices where project_id = $1 order by sequence",
        [res.r.project_id]);
      expect(invoices.map((i) => i.kind)).toEqual(["deposit", "milestone", "final"]);
      expect(invoices.map((i) => i.status)).toEqual(["open", "draft", "draft"]);
      expect(invoices.reduce((s, i) => s + Number(i.total_cents), 0)).toBe(100001);

      const [project] = await db.as<{ status: string; total_cents: string }>(
        "authenticated", alice, "select status, total_cents from public.projects where id = $1", [res.r.project_id]);
      expect(project).toEqual({ status: "awaiting_payment", total_cents: "100001" });

      // Clients only see issued invoices, never drafts.
      const visible = await db.as("authenticated", alice,
        "select id from public.invoices where project_id = $1", [res.r.project_id]);
      expect(visible).toHaveLength(1);
    });

    it("splits SST proportionally when the quote carries tax", async () => {
      const quote = await createSentQuote(alice, "alice@client.test", { subtotal: 200000, taxRate: 8, tax: 16000 });
      const [res] = await db.as<{ r: { project_id: string } }>(
        "authenticated", alice, "select public.accept_quote($1) as r", [quote.id]);
      const inv = await db.asSuper<{ subtotal_cents: string; tax_cents: string; total_cents: string }>(
        "select subtotal_cents, tax_cents, total_cents from public.invoices where project_id = $1 order by sequence",
        [res.r.project_id]);
      expect(inv.map((i) => Number(i.tax_cents))).toEqual([8000, 8000]);
      expect(inv.map((i) => Number(i.total_cents))).toEqual([108000, 108000]);
    });

    it("refuses double acceptance, other clients and expired quotes", async () => {
      const quote = await createSentQuote(alice, "alice@client.test");
      await expect(db.as("authenticated", bob, "select public.accept_quote($1)", [quote.id]))
        .rejects.toThrow(/not found/);
      await db.as("authenticated", alice, "select public.accept_quote($1)", [quote.id]);
      await expect(db.as("authenticated", alice, "select public.accept_quote($1)", [quote.id]))
        .rejects.toThrow(/no longer open/);

      const expired = await createSentQuote(alice, "alice@client.test", { validUntil: "2020-01-01" });
      await expect(db.as("authenticated", alice, "select public.accept_quote($1)", [expired.id]))
        .rejects.toThrow(/expired/);
    });

    it("hides draft quotes from clients and lets them decline sent ones", async () => {
      await db.as("authenticated", admin,
        `insert into public.quotes (client_id, client_email, title, status) values ($1, 'bob@client.test', 'Draft only', 'draft')`, [bob]);
      const drafts = await db.as("authenticated", bob, "select id from public.quotes where status = 'draft'");
      expect(drafts).toHaveLength(0);

      const sent = await createSentQuote(bob, "bob@client.test");
      await db.as("authenticated", bob, "select public.decline_quote($1, 'Budget')", [sent.id]);
      const [row] = await db.asSuper<{ status: string }>("select status from public.quotes where id = $1", [sent.id]);
      expect(row.status).toBe("declined");
    });
  });

  describe("direct online orders", () => {
    it("creates an order priced from the database with a 50% deposit invoice", async () => {
      const [svc] = await db.asSuper<{ id: string }>("select id from public.services where slug = 'starter-website'");
      const [res] = await db.as<{ r: { project_id: string; invoice_id: string } }>(
        "authenticated", bob, "select public.create_direct_order($1, 'Bakery site') as r", [svc.id]);
      const [deposit] = await db.as<{ total_cents: string; status: string }>(
        "authenticated", bob, "select total_cents, status from public.invoices where id = $1", [res.r.invoice_id]);
      expect(deposit).toEqual({ total_cents: "39950", status: "open" });
    });

    it("rejects quote-only packages", async () => {
      const [svc] = await db.asSuper<{ id: string }>("select id from public.services where slug = 'business-website'");
      await expect(db.as("authenticated", bob, "select public.create_direct_order($1, null)", [svc.id]))
        .rejects.toThrow(/request a quotation/);
    });
  });

  describe("payment recording", () => {
    async function openInvoiceFor(clientId: string, email: string) {
      const quote = await createSentQuote(clientId, email);
      const [res] = await db.as<{ r: { project_id: string; invoice_id: string } }>(
        "authenticated", clientId, "select public.accept_quote($1) as r", [quote.id]);
      return res.r;
    }

    it("only the service role (verified webhook) can record Stripe payments", async () => {
      const { invoice_id } = await openInvoiceFor(alice, "alice@client.test");
      await expect(
        db.as("authenticated", alice,
          "select public.record_stripe_payment('evt_fake', 'checkout.session.completed', $1, 150000, 'myr', 'pi_fake', 'card', null, now())",
          [invoice_id]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.as("authenticated", alice,
          "insert into public.payments (invoice_id, client_id, amount_cents, provider) values ($1, $2, 150000, 'manual')",
          [invoice_id, alice]),
      ).rejects.toThrow(/permission denied/);
    });

    it("records a verified payment once, marks the invoice paid and starts the project", async () => {
      const { invoice_id, project_id } = await openInvoiceFor(alice, "alice@client.test");
      const call = (evt: string, pi: string) => db.as<{ r: string }>("service_role", null,
        "select public.record_stripe_payment($1, 'checkout.session.completed', $2, 150000, 'myr', $3, 'card', 'https://pay.stripe.com/receipts/x', now()) as r",
        [evt, invoice_id, pi]);

      expect((await call("evt_1", "pi_1"))[0].r).toBe("recorded");
      expect((await call("evt_1", "pi_1"))[0].r).toBe("duplicate_event");
      expect((await call("evt_2", "pi_1"))[0].r).toBe("duplicate_payment");

      const [inv] = await db.asSuper<{ status: string; amount_paid_cents: string }>(
        "select status, amount_paid_cents from public.invoices where id = $1", [invoice_id]);
      expect(inv).toEqual({ status: "paid", amount_paid_cents: "150000" });

      const [proj] = await db.asSuper<{ status: string }>("select status from public.projects where id = $1", [project_id]);
      expect(proj.status).toBe("planning");

      const payments = await db.as<{ receipt_number: string }>(
        "authenticated", alice, "select receipt_number from public.payments where invoice_id = $1", [invoice_id]);
      expect(payments).toHaveLength(1);
      expect(payments[0].receipt_number).toMatch(/^RCT-\d{4}-\d{4}$/);

      // Bob cannot see Alice's payment.
      const bobView = await db.as("authenticated", bob,
        "select id from public.payments where invoice_id = $1", [invoice_id]);
      expect(bobView).toHaveLength(0);

      const notes = await db.asSuper<{ title: string }>(
        "select title from public.notifications where user_id = $1 and title like 'Payment received%'", [alice]);
      expect(notes.length).toBeGreaterThan(0);
    });

    it("flags payments that do not match an invoice instead of guessing", async () => {
      const [res] = await db.as<{ r: string }>("service_role", null,
        "select public.record_stripe_payment('evt_x', 'checkout.session.completed', gen_random_uuid(), 5000, 'myr', 'pi_x', 'card', null, now()) as r");
      expect(res.r).toBe("invoice_not_found");
      const alerts = await db.asSuper("select id from public.notifications where user_id = $1 and title = 'Unmatched Stripe payment'", [admin]);
      expect(alerts.length).toBe(1);
    });

    it("records refunds against the original payment", async () => {
      const { invoice_id } = await openInvoiceFor(bob, "bob@client.test");
      await db.as("service_role", null,
        "select public.record_stripe_payment('evt_r1', 'checkout.session.completed', $1, 150000, 'myr', 'pi_r1', 'card', null, now())",
        [invoice_id]);
      const [r] = await db.as<{ r: string }>("service_role", null, "select public.record_stripe_refund('evt_r2', 'pi_r1', 50000) as r");
      expect(r.r).toBe("recorded");
      const [pay] = await db.asSuper<{ status: string; refunded_cents: string }>(
        "select status, refunded_cents from public.payments where provider_payment_id = 'pi_r1'");
      expect(pay).toEqual({ status: "partially_refunded", refunded_cents: "50000" });
    });

    it("lets only admins record manual bank transfers", async () => {
      const { invoice_id } = await openInvoiceFor(bob, "bob@client.test");
      await expect(db.as("authenticated", bob,
        "select public.record_manual_payment($1, 150000, 'bank_transfer', 'ref', now())", [invoice_id]))
        .rejects.toThrow(/Admin only/);
      await db.as("authenticated", admin,
        "select public.record_manual_payment($1, 150000, 'duitnow', 'DN123', now())", [invoice_id]);
      const [inv] = await db.asSuper<{ status: string }>("select status from public.invoices where id = $1", [invoice_id]);
      expect(inv.status).toBe("paid");
    });
  });

  describe("subscriptions", () => {
    it("mirrors Stripe subscriptions and their paid invoices idempotently", async () => {
      const [svc] = await db.asSuper<{ id: string }>("select id from public.services where slug = 'business-maintenance'");
      // invoice.paid can arrive before the subscription is synced: it must fail so Stripe retries.
      await expect(db.as("service_role", null,
        "select public.record_subscription_invoice('evt_s0', 'in_1', 'sub_1', 24900, 'myr', 'pi_s1', null, null, 'Business Maintenance', now())"))
        .rejects.toThrow(/not synced/);

      await db.as("service_role", null,
        "select public.upsert_stripe_subscription($1, $2, null, 'Business Maintenance', 'sub_1', 'cus_1', 'active', 24900, now() + interval '30 days', false, null)",
        [alice, svc.id]);
      const [r1] = await db.as<{ r: string }>("service_role", null,
        "select public.record_subscription_invoice('evt_s1', 'in_1', 'sub_1', 24900, 'myr', 'pi_s1', 'https://invoice', 'https://pdf', 'Business Maintenance', now()) as r");
      expect(r1.r).toBe("recorded");
      const [r2] = await db.as<{ r: string }>("service_role", null,
        "select public.record_subscription_invoice('evt_s2', 'in_1', 'sub_1', 24900, 'myr', 'pi_s1', null, null, null, now()) as r");
      expect(r2.r).toBe("duplicate_invoice");

      const subs = await db.as<{ status: string }>("authenticated", alice, "select status from public.subscriptions");
      expect(subs).toEqual([{ status: "active" }]);
      expect(await db.as("authenticated", bob, "select id from public.subscriptions")).toHaveLength(0);

      // Clients cannot fake a subscription.
      await expect(db.as("authenticated", bob,
        "insert into public.subscriptions (client_id, plan_name, status, price_cents) values ($1, 'x', 'active', 1)", [bob]))
        .rejects.toThrow(/permission denied/);
    });
  });

  describe("bookings, files, testimonials, notifications", () => {
    it("prevents double-booking the same slot", async () => {
      const insert = "insert into public.bookings (name, email, topic, start_at, end_at) values ('A', 'a@x.test', 'Website', '2030-01-07T02:00:00Z', '2030-01-07T02:30:00Z')";
      await db.as("service_role", null, insert);
      await expect(db.as("service_role", null, insert)).rejects.toThrow(/duplicate key/);
    });

    it("restricts storage objects and file records to the owner's folder", async () => {
      await db.as("authenticated", alice,
        "insert into storage.objects (bucket_id, name) values ('project-files', $1)", [`${alice}/requests/logo.png`]);
      await expect(db.as("authenticated", alice,
        "insert into storage.objects (bucket_id, name) values ('project-files', $1)", [`${bob}/requests/evil.png`]))
        .rejects.toThrow(/row-level security/);
      await expect(db.as("authenticated", alice,
        "insert into public.files (owner_id, path, filename, size_bytes, uploaded_by) values ($1, $2, 'x.png', 1, $1)",
        [alice, `${bob}/requests/x.png`]))
        .rejects.toThrow(/row-level security/);
      const bobSees = await db.as("authenticated", bob, "select id from storage.objects where bucket_id = 'project-files'");
      expect(bobSees).toHaveLength(0);
    });

    it("never lets a client publish their own testimonial", async () => {
      await expect(db.as("authenticated", alice,
        "insert into public.testimonials (author_name, quote, submitted_by, consent_to_publish, is_published) values ('Alice', 'Great work on our site!', $1, true, true)",
        [alice])).rejects.toThrow(/row-level security/);
      await db.as("authenticated", alice,
        "insert into public.testimonials (author_name, quote, submitted_by, consent_to_publish) values ('Alice', 'Great work on our site!', $1, true)",
        [alice]);
      const publicView = await db.as("anon", null, "select id from public.testimonials");
      expect(publicView).toHaveLength(0);
      await expect(db.asSuper(
        "insert into public.testimonials (author_name, quote, consent_to_publish, is_published) values ('X', 'No consent given here', false, true)"))
        .rejects.toThrow(/testimonials_publish_requires_consent/);
    });

    it("lets users mark only their own notifications as read", async () => {
      const [n] = await db.asSuper<{ id: string }>(
        "insert into public.notifications (user_id, title) values ($1, 'Hi') returning id", [alice]);
      const none = await db.as("authenticated", bob,
        "update public.notifications set read_at = now() where id = $1 returning id", [n.id]);
      expect(none).toHaveLength(0);
      const done = await db.as("authenticated", alice,
        "update public.notifications set read_at = now() where id = $1 returning id", [n.id]);
      expect(done).toHaveLength(1);
      await expect(db.as("authenticated", alice,
        "update public.notifications set title = 'Changed' where id = $1", [n.id])).rejects.toThrow(/permission denied/);
    });

    it("rate limits per key within a window", async () => {
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        const [r] = await db.as<{ ok: boolean }>("service_role", null,
          "select public.check_rate_limit('test:ip', 3, 60) as ok");
        results.push(r.ok);
      }
      expect(results).toEqual([true, true, true, false]);
    });

    it("numbers documents sequentially per year", async () => {
      const rows = await db.asSuper<{ number: string }>("select number from public.quotes order by created_at, number");
      const nums = rows.map((r) => Number(r.number.split("-")[2]));
      expect(new Set(nums).size).toBe(nums.length);
      expect(rows[0].number).toMatch(/^Q-\d{4}-\d{4}$/);
    });
  });
});
