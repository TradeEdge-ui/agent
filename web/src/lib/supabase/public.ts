import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/** Cookie-less anonymous client for public, cacheable reads (catalogue, portfolio). */
export function createPublicClient() {
  if (!isSupabaseConfigured()) return null;
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
