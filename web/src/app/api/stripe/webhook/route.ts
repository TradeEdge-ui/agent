import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { handleStripeEvent, type WebhookDb } from "@/lib/stripe/webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function adminDb(): WebhookDb {
  const admin = createAdminClient();
  return {
    rpc: async (fn, args) => {
      const r = await admin.rpc(fn, args);
      return { data: r.data, error: r.error };
    },
    findClientIdByCustomer: async (customerId) => {
      const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
      return data?.id ?? null;
    },
  };
}

/**
 * Stripe → us. Every request must carry a valid Stripe-Signature for our
 * webhook secret; anything else is rejected before touching the database.
 * Returning a non-2xx makes Stripe retry, which is safe because processing
 * is idempotent (stripe_events + unique payment ids).
 */
export async function POST(request: Request) {
  if (!env.stripeWebhookSecret || !env.stripeSecretKey) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  const body = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.stripeWebhookSecret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await handleStripeEvent(event, { stripe, db: adminDb() });
    return Response.json({ received: true, ...result });
  } catch (e) {
    console.error(`Stripe webhook ${event.type} ${event.id} failed`, e);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
