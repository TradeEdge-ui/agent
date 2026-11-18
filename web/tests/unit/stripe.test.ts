import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { buildInvoiceCheckoutParams, buildSubscriptionCheckoutParams } from "@/lib/stripe/params";
import { handleStripeEvent, type WebhookDb, type WebhookStripe } from "@/lib/stripe/webhook";

const invoice = { id: "11111111-1111-4111-8111-111111111111", number: "INV-2026-0001", title: "Starter Website — Deposit", client_id: "22222222-2222-4222-8222-222222222222" };

describe("checkout session parameters", () => {
  it("charges exactly the outstanding amount in MYR and links the payment to the invoice", () => {
    const p = buildInvoiceCheckoutParams({ siteUrl: "https://aryzz.test", customerId: "cus_1", invoice, amountDueCents: 39950 });
    expect(p.mode).toBe("payment");
    expect(p.customer).toBe("cus_1");
    expect(p.line_items?.[0].price_data?.currency).toBe("myr");
    expect(p.line_items?.[0].price_data?.unit_amount).toBe(39950);
    expect(p.metadata).toMatchObject({ kind: "invoice", invoice_id: invoice.id, client_id: invoice.client_id, amount_cents: "39950" });
    expect(p.payment_intent_data?.metadata).toMatchObject({ invoice_id: invoice.id });
    expect(p.success_url).toBe(`https://aryzz.test/dashboard/invoices/${invoice.id}?checkout=success`);
    // Never restrict payment methods in code: FPX/GrabPay/cards are managed in the Stripe dashboard.
    expect("payment_method_types" in p).toBe(false);
  });

  it("refuses amounts below Stripe's RM2 minimum or non-integer sen", () => {
    expect(() => buildInvoiceCheckoutParams({ siteUrl: "x", customerId: "c", invoice, amountDueCents: 100 })).toThrow();
    expect(() => buildInvoiceCheckoutParams({ siteUrl: "x", customerId: "c", invoice, amountDueCents: 1000.5 })).toThrow();
  });

  it("creates monthly recurring subscriptions with client and plan metadata", () => {
    const p = buildSubscriptionCheckoutParams({ siteUrl: "https://aryzz.test", customerId: "cus_1", clientId: invoice.client_id, service: { id: "svc_1", name: "Business Maintenance", price_min_cents: 24900 }, projectId: null });
    expect(p.mode).toBe("subscription");
    expect(p.line_items?.[0].price_data).toMatchObject({ currency: "myr", unit_amount: 24900, recurring: { interval: "month" } });
    expect(p.subscription_data?.metadata).toMatchObject({ client_id: invoice.client_id, service_id: "svc_1", plan_name: "Business Maintenance" });
    expect(p.subscription_data?.metadata).not.toHaveProperty("project_id");
  });
});

function fakeDeps(overrides: Partial<{ rpc: WebhookDb["rpc"] }> = {}) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const db: WebhookDb = {
    rpc: overrides.rpc ?? (async (fn, args) => { calls.push({ fn, args }); return { data: "recorded", error: null }; }),
    findClientIdByCustomer: async () => "client-from-customer",
  };
  const stripe = {
    paymentIntents: { retrieve: vi.fn(async () => ({ latest_charge: { payment_method_details: { type: "fpx" }, receipt_url: "https://pay.stripe.com/receipts/r1" }, payment_method_types: ["card"] })) },
    subscriptions: {
      retrieve: vi.fn(async (id: string) => ({
        id, status: "active", customer: "cus_1", cancel_at_period_end: false, canceled_at: null,
        metadata: { client_id: invoice.client_id, service_id: "svc_1", plan_name: "Business Maintenance" },
        items: { data: [{ current_period_end: 1893456000, price: { unit_amount: 24900, nickname: null } }] },
      })),
    },
    invoices: { retrieve: vi.fn(async () => ({ payments: { data: [{ status: "paid", payment: { payment_intent: "pi_sub_1" } }] } })) },
  } as unknown as WebhookStripe;
  return { db, stripe, calls };
}

function event(type: string, object: Record<string, unknown>, id = "evt_1"): Stripe.Event {
  return { id, type, created: 1893456000, data: { object } } as unknown as Stripe.Event;
}

describe("webhook event handling", () => {
  it("records a paid checkout session against its invoice with the verified amount", async () => {
    const { db, stripe, calls } = fakeDeps();
    const res = await handleStripeEvent(
      event("checkout.session.completed", { mode: "payment", payment_status: "paid", amount_total: 39950, currency: "myr", payment_intent: "pi_1", metadata: { kind: "invoice", invoice_id: invoice.id } }),
      { db, stripe },
    );
    expect(res.outcome).toBe("recorded");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      fn: "record_stripe_payment",
      args: expect.objectContaining({ p_event_id: "evt_1", p_invoice_id: invoice.id, p_amount: 39950, p_currency: "myr", p_payment_intent_id: "pi_1", p_method: "stripe_fpx", p_receipt_url: "https://pay.stripe.com/receipts/r1" }),
    });
  });

  it("does NOT mark anything paid while an async (FPX) payment is still pending", async () => {
    const { db, stripe, calls } = fakeDeps();
    const res = await handleStripeEvent(
      event("checkout.session.completed", { mode: "payment", payment_status: "unpaid", amount_total: 39950, currency: "myr", payment_intent: "pi_1", metadata: { kind: "invoice", invoice_id: invoice.id } }),
      { db, stripe },
    );
    expect(res.outcome).toBe("awaiting_async_payment");
    expect(calls).toHaveLength(0);
  });

  it("records the payment when the async payment later succeeds", async () => {
    const { db, stripe, calls } = fakeDeps();
    await handleStripeEvent(
      event("checkout.session.async_payment_succeeded", { mode: "payment", payment_status: "paid", amount_total: 39950, currency: "myr", payment_intent: "pi_1", metadata: { kind: "invoice", invoice_id: invoice.id } }, "evt_2"),
      { db, stripe },
    );
    expect(calls[0].fn).toBe("record_stripe_payment");
  });

  it("syncs subscriptions from Stripe's authoritative state, then records subscription invoices", async () => {
    const { db, stripe, calls } = fakeDeps();
    await handleStripeEvent(
      event("invoice.paid", { id: "in_1", amount_paid: 24900, currency: "myr", parent: { subscription_details: { subscription: "sub_1" } }, lines: { data: [{ description: "Business Maintenance" }] }, status_transitions: { paid_at: 1893456000 } }),
      { db, stripe },
    );
    expect(calls.map((c) => c.fn)).toEqual(["upsert_stripe_subscription", "record_subscription_invoice"]);
    expect(calls[0].args).toMatchObject({ p_client_id: invoice.client_id, p_status: "active", p_price_cents: 24900, p_stripe_subscription_id: "sub_1" });
    expect(calls[1].args).toMatchObject({ p_stripe_invoice_id: "in_1", p_amount: 24900, p_payment_ref: "pi_sub_1" });
  });

  it("records refunds issued from the Stripe dashboard", async () => {
    const { db, stripe, calls } = fakeDeps();
    await handleStripeEvent(event("charge.refunded", { payment_intent: "pi_1", amount_refunded: 10000 }), { db, stripe });
    expect(calls[0]).toEqual({ fn: "record_stripe_refund", args: { p_event_id: "evt_1", p_payment_intent_id: "pi_1", p_refunded_total: 10000 } });
  });

  it("throws on database errors so Stripe retries the event (idempotent on retry)", async () => {
    const { stripe } = fakeDeps();
    const db: WebhookDb = { rpc: async () => ({ data: null, error: { message: "boom" } }), findClientIdByCustomer: async () => null };
    await expect(
      handleStripeEvent(event("checkout.session.completed", { mode: "payment", payment_status: "paid", amount_total: 100, currency: "myr", payment_intent: null, metadata: { kind: "invoice", invoice_id: invoice.id } }), { db, stripe }),
    ).rejects.toThrow(/boom/);
  });

  it("ignores unrelated events", async () => {
    const { db, stripe, calls } = fakeDeps();
    expect((await handleStripeEvent(event("customer.created", {}), { db, stripe })).handled).toBe(false);
    expect((await handleStripeEvent(event("checkout.session.completed", { mode: "payment", payment_status: "paid", metadata: {} }), { db, stripe })).handled).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

// ------------------------------------------------------------------------
// Route-level test with REAL Stripe signature verification.
// ------------------------------------------------------------------------
const rpcMock = vi.fn(async () => ({ data: "recorded", error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  }),
}));

describe("POST /api/stripe/webhook", () => {
  const secret = "whsec_test_secret_for_unit_tests";
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy_key_for_unit_tests";
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    rpcMock.mockClear();
    vi.resetModules();
  });

  const payload = JSON.stringify({
    id: "evt_route_1",
    object: "event",
    type: "checkout.session.completed",
    created: 1893456000,
    data: { object: { object: "checkout.session", mode: "payment", payment_status: "paid", amount_total: 39950, currency: "myr", payment_intent: null, metadata: { kind: "invoice", invoice_id: invoice.id } } },
  });

  async function post(body: string, signature?: string) {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    return POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body, headers: signature ? { "stripe-signature": signature } : {} }));
  }

  it("accepts a correctly signed event and records the payment", async () => {
    const sig = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
    const res = await post(payload, sig);
    expect(res.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("record_stripe_payment", expect.objectContaining({ p_event_id: "evt_route_1", p_amount: 39950, p_invoice_id: invoice.id }));
  });

  it("rejects unsigned, wrongly signed and tampered requests without touching the database", async () => {
    expect((await post(payload)).status).toBe(400);
    const wrong = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret: "whsec_attacker" });
    expect((await post(payload, wrong)).status).toBe(400);
    const sig = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
    const tampered = payload.replace("39950", "1");
    expect((await post(tampered, sig)).status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the webhook secret is not configured", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "";
    vi.resetModules();
    expect((await post(payload, "t=1,v1=x")).status).toBe(503);
  });

  it("returns 500 (so Stripe retries) when recording fails", async () => {
    rpcMock.mockImplementationOnce(async () => ({ data: null, error: { message: "db down" } }) as never);
    const sig = new Stripe("sk_test_x").webhooks.generateTestHeaderString({ payload, secret });
    const res = await post(payload, sig);
    expect(res.status).toBe(500);
  });
});
