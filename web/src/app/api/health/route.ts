import { integrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Public health check. Reports only whether integrations are configured, never secrets. */
export async function GET() {
  const s = integrationStatus();
  return Response.json({
    status: "ok",
    database: s.supabase && s.supabaseServiceRole,
    payments: s.stripe && s.stripeWebhook ? s.stripeMode : "not_configured",
    email: s.email,
    time: new Date().toISOString(),
  });
}
