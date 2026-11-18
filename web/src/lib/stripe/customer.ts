import "server-only";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

/** Returns the Stripe customer for a profile, creating and saving it once. */
export async function ensureStripeCustomer(profile: Profile): Promise<string> {
  if (profile.stripe_customer_id) return profile.stripe_customer_id;
  const stripe = getStripe();
  const customer = await stripe.customers.create(
    {
      email: profile.email,
      name: profile.full_name ?? undefined,
      phone: profile.phone ?? undefined,
      metadata: { client_id: profile.id, company: profile.company_name ?? "" },
    },
    { idempotencyKey: `customer-create-${profile.id}` },
  );
  const admin = createAdminClient();
  // Only set if still empty (guards against a concurrent request).
  const { data } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", profile.id)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id")
    .maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;
  const { data: fresh } = await admin.from("profiles").select("stripe_customer_id").eq("id", profile.id).single();
  return fresh?.stripe_customer_id ?? customer.id;
}
