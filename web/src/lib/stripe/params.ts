import type Stripe from "stripe";

/**
 * Pure builders for Stripe Checkout parameters. Amounts always come from our
 * database (never from the browser), and metadata ties the payment back to
 * the invoice/subscription when the signed webhook arrives.
 */

export function buildInvoiceCheckoutParams(input: {
  siteUrl: string;
  customerId: string;
  invoice: { id: string; number: string; title: string; client_id: string };
  amountDueCents: number;
}): Stripe.Checkout.SessionCreateParams {
  const { siteUrl, customerId, invoice, amountDueCents } = input;
  if (!Number.isInteger(amountDueCents) || amountDueCents < 200) {
    // Stripe's MYR minimum charge is RM2.00.
    throw new Error("Amount due is below the minimum payable online.");
  }
  const metadata = {
    kind: "invoice",
    invoice_id: invoice.id,
    invoice_number: invoice.number,
    client_id: invoice.client_id,
    amount_cents: String(amountDueCents),
  };
  return {
    mode: "payment",
    customer: customerId,
    client_reference_id: invoice.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "myr",
          unit_amount: amountDueCents,
          product_data: {
            name: `Invoice ${invoice.number}`,
            description: invoice.title.slice(0, 250),
          },
        },
      },
    ],
    metadata,
    payment_intent_data: {
      metadata,
      description: `${invoice.number} — ${invoice.title}`.slice(0, 500),
    },
    success_url: `${siteUrl}/dashboard/invoices/${invoice.id}?checkout=success`,
    cancel_url: `${siteUrl}/dashboard/invoices/${invoice.id}?checkout=cancelled`,
  };
}

export function buildSubscriptionCheckoutParams(input: {
  siteUrl: string;
  customerId: string;
  clientId: string;
  service: { id: string; name: string; price_min_cents: number };
  projectId?: string | null;
}): Stripe.Checkout.SessionCreateParams {
  const { siteUrl, customerId, clientId, service, projectId } = input;
  if (!Number.isInteger(service.price_min_cents) || service.price_min_cents < 200) {
    throw new Error("This plan does not have a valid monthly price.");
  }
  const metadata = {
    kind: "subscription",
    client_id: clientId,
    service_id: service.id,
    plan_name: service.name,
    ...(projectId ? { project_id: projectId } : {}),
  };
  return {
    mode: "subscription",
    customer: customerId,
    client_reference_id: clientId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "myr",
          unit_amount: service.price_min_cents,
          recurring: { interval: "month" },
          product_data: { name: service.name },
        },
      },
    ],
    metadata,
    subscription_data: { metadata },
    success_url: `${siteUrl}/dashboard/subscriptions?checkout=success`,
    cancel_url: `${siteUrl}/dashboard/subscriptions?checkout=cancelled`,
  };
}
