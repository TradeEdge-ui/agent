import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Service-role client: BYPASSES Row Level Security. Only use it in trusted
 * server code after you have validated input and authorised the caller
 * (verified webhooks, public form handlers, cron jobs).
 */
export function createAdminClient() {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error("Supabase service role is not configured (SUPABASE_SECRET_KEY).");
  }
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
