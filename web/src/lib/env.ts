import "server-only";

/**
 * Server-side environment access. Nothing here is ever sent to the browser.
 * Each integration degrades gracefully when its keys are missing, and the
 * admin Settings page shows exactly what is (not) configured.
 */
export const env = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom: process.env.EMAIL_FROM || "",
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL || "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
  cronSecret: process.env.CRON_SECRET || "",
};

export function integrationStatus() {
  const stripeMode = env.stripeSecretKey.startsWith("sk_live_")
    ? "live"
    : env.stripeSecretKey.startsWith("sk_test_") || env.stripeSecretKey.startsWith("rk_test_")
      ? "test"
      : env.stripeSecretKey
        ? "unknown"
        : "missing";
  return {
    supabase: Boolean(env.supabaseUrl && env.supabasePublishableKey),
    supabaseServiceRole: Boolean(env.supabaseSecretKey),
    stripe: Boolean(env.stripeSecretKey),
    stripeMode,
    stripeWebhook: Boolean(env.stripeWebhookSecret),
    email: Boolean(env.resendApiKey && env.emailFrom),
    ai: Boolean(env.anthropicApiKey),
    aiModel: env.anthropicModel,
    cron: Boolean(env.cronSecret),
  } as const;
}

export function isSupabaseConfigured() {
  return Boolean(env.supabaseUrl && env.supabasePublishableKey);
}
