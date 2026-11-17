import "server-only";
import Stripe from "stripe";
import { env } from "@/lib/env";

let _stripe: Stripe | null = null;

/** Lazily constructed so builds without keys still succeed. */
export function getStripe(): Stripe {
  if (!env.stripeSecretKey) {
    throw new StripeNotConfiguredError();
  }
  if (!_stripe) {
    _stripe = new Stripe(env.stripeSecretKey, {
      appInfo: { name: "ARyzz AI Solutions Platform" },
      maxNetworkRetries: 2,
      timeout: 20_000,
    });
  }
  return _stripe;
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Online payments are not configured yet. Please contact us to pay by bank transfer.");
  }
}

export function isStripeConfigured() {
  return Boolean(env.stripeSecretKey);
}
