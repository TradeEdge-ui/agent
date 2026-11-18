import type Stripe from "stripe";

/**
 * Stripe webhook processing. The route handler verifies the signature first;
 * this module then reconciles the event with our database. Payment state is
 * only ever changed here (from verified events) or by an admin recording a
 * bank transfer — never from the browser's success redirect.
 *
 * Dependencies are injected so the logic can be unit-tested without network.
 */

export type RpcResult = { data: unknown; error: { message: string } | null };

export interface WebhookDb {
  rpc(fn: string, args: Record<string, unknown>): Promise<RpcResult>;
  findClientIdByCustomer(customerId: string): Promise<string | null>;
}

export type WebhookStripe = {
  paymentIntents: Pick<Stripe["paymentIntents"], "retrieve">;
  subscriptions: Pick<Stripe["subscriptions"], "retrieve">;
  invoices: Pick<Stripe["invoices"], "retrieve">;
};

export type WebhookResult = { handled: boolean; outcome: string };

const SUBSCRIPTION_STATUSES = new Set([
  "incomplete", "incomplete_expired", "trialing", "active", "past_due", "canceled", "unpaid", "paused",
]);

function idOf(v: string | { id: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

async function rpcOrThrow(db: WebhookDb, fn: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn} failed: ${error.message}`);
  return data;
}

async function paymentDetails(stripe: WebhookStripe, paymentIntentId: string | null) {
  if (!paymentIntentId) return { method: "stripe", receiptUrl: null as string | null };
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const charge = typeof pi.latest_charge === "object" && pi.latest_charge ? (pi.latest_charge as Stripe.Charge) : null;
  const type = charge?.payment_method_details?.type ?? pi.payment_method_types?.[0] ?? "stripe";
  return { method: `stripe_${type}`, receiptUrl: charge?.receipt_url ?? null };
}

export async function recordCheckoutPayment(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  deps: { stripe: WebhookStripe; db: WebhookDb },
): Promise<WebhookResult> {
  if (session.payment_status !== "paid") {
    // FPX/e-wallet payments may complete asynchronously; wait for
    // checkout.session.async_payment_succeeded.
    return { handled: true, outcome: "awaiting_async_payment" };
  }
  const invoiceId = session.metadata?.invoice_id ?? session.client_reference_id ?? null;
  const paymentIntentId = idOf(session.payment_intent as string | { id: string } | null);
  const { method, receiptUrl } = await paymentDetails(deps.stripe, paymentIntentId);
  const outcome = await rpcOrThrow(deps.db, "record_stripe_payment", {
    p_event_id: event.id,
    p_event_type: event.type,
    p_invoice_id: invoiceId,
    p_amount: session.amount_total ?? 0,
    p_currency: session.currency ?? "myr",
    p_payment_intent_id: paymentIntentId,
    p_method: method,
    p_receipt_url: receiptUrl,
    p_paid_at: new Date(event.created * 1000).toISOString(),
  });
  return { handled: true, outcome: String(outcome) };
}

export async function syncSubscription(
  subscriptionId: string,
  deps: { stripe: WebhookStripe; db: WebhookDb },
): Promise<WebhookResult> {
  const sub = await deps.stripe.subscriptions.retrieve(subscriptionId);
  const customerId = idOf(sub.customer as string | { id: string });
  const meta = sub.metadata ?? {};
  const clientId = meta.client_id || (customerId ? await deps.db.findClientIdByCustomer(customerId) : null);
  if (!clientId) {
    return { handled: true, outcome: "no_matching_client" };
  }
  const item = sub.items?.data?.[0];
  const priceCents = item?.price?.unit_amount ?? 0;
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  const status = SUBSCRIPTION_STATUSES.has(sub.status) ? sub.status : "incomplete";
  await rpcOrThrow(deps.db, "upsert_stripe_subscription", {
    p_client_id: clientId,
    p_service_id: meta.service_id || null,
    p_project_id: meta.project_id || null,
    p_plan_name: meta.plan_name || item?.price?.nickname || "Maintenance plan",
    p_stripe_subscription_id: sub.id,
    p_stripe_customer_id: customerId,
    p_status: status,
    p_price_cents: priceCents,
    p_current_period_end: periodEnd,
    p_cancel_at_period_end: sub.cancel_at_period_end,
    p_canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
  });
  return { handled: true, outcome: `subscription_${status}` };
}

function subscriptionIdFromInvoice(inv: Stripe.Invoice): string | null {
  const details = inv.parent?.subscription_details;
  return details ? idOf(details.subscription as string | { id: string }) : null;
}

export async function recordSubscriptionInvoice(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  deps: { stripe: WebhookStripe; db: WebhookDb },
): Promise<WebhookResult> {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId || !invoice.id) return { handled: false, outcome: "not_a_subscription_invoice" };

  // Make sure the subscription mirror exists before attaching the invoice.
  await syncSubscription(subscriptionId, deps);

  // Prefer the PaymentIntent id (lets charge.refunded find this payment).
  let paymentRef: string = invoice.id;
  try {
    const full = await deps.stripe.invoices.retrieve(invoice.id, { expand: ["payments"] });
    const paid = full.payments?.data?.find((p) => p.status === "paid") ?? full.payments?.data?.[0];
    const pi = paid?.payment?.payment_intent;
    if (pi) paymentRef = idOf(pi as string | { id: string }) ?? paymentRef;
  } catch {
    // Fall back to the invoice id.
  }

  const outcome = await rpcOrThrow(deps.db, "record_subscription_invoice", {
    p_event_id: event.id,
    p_stripe_invoice_id: invoice.id,
    p_stripe_subscription_id: subscriptionId,
    p_amount: invoice.amount_paid,
    p_currency: invoice.currency,
    p_payment_ref: paymentRef,
    p_hosted_url: invoice.hosted_invoice_url ?? null,
    p_pdf_url: invoice.invoice_pdf ?? null,
    p_description: invoice.lines?.data?.[0]?.description ?? null,
    p_paid_at: invoice.status_transitions?.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
      : new Date(event.created * 1000).toISOString(),
  });
  return { handled: true, outcome: String(outcome) };
}

export async function handleStripeEvent(
  event: Stripe.Event,
  deps: { stripe: WebhookStripe; db: WebhookDb },
): Promise<WebhookResult> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        const subId = idOf(session.subscription as string | { id: string } | null);
        return subId ? syncSubscription(subId, deps) : { handled: true, outcome: "no_subscription" };
      }
      if (session.mode === "payment" && session.metadata?.kind === "invoice") {
        return recordCheckoutPayment(event, session, deps);
      }
      return { handled: false, outcome: "ignored_session" };
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clientId = session.metadata?.client_id;
      if (clientId) {
        await deps.db.rpc("notify_user", {
          p_user_id: clientId,
          p_title: "Payment was not completed",
          p_body: `Your bank did not confirm the payment for ${session.metadata?.invoice_number ?? "your invoice"}. No money was taken. You can try again from your dashboard.`,
          p_link: session.metadata?.invoice_id ? `/dashboard/invoices/${session.metadata.invoice_id}` : "/dashboard/invoices",
        });
      }
      return { handled: true, outcome: "async_payment_failed" };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed": {
      const sub = event.data.object as Stripe.Subscription;
      return syncSubscription(sub.id, deps);
    }
    case "invoice.paid": {
      return recordSubscriptionInvoice(event, event.data.object as Stripe.Invoice, deps);
    }
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = subscriptionIdFromInvoice(inv);
      if (subId) await syncSubscription(subId, deps);
      return { handled: true, outcome: "subscription_payment_failed" };
    }
    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const pi = idOf(charge.payment_intent as string | { id: string } | null);
      if (!pi) return { handled: false, outcome: "refund_without_payment_intent" };
      const outcome = await rpcOrThrow(deps.db, "record_stripe_refund", {
        p_event_id: event.id,
        p_payment_intent_id: pi,
        p_refunded_total: charge.amount_refunded,
      });
      return { handled: true, outcome: String(outcome) };
    }
    default:
      return { handled: false, outcome: "ignored" };
  }
}
