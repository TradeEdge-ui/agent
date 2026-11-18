import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Profile } from "@/lib/types";

export type SessionUser = { id: string; email: string; profile: Profile };

/**
 * Authoritative current-user lookup (validates the session with Supabase Auth
 * and loads the profile). Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
  if (!profile) return null;
  return { id: data.user.id, email: data.user.email ?? profile.email, profile: profile as Profile };
});

export async function requireUser(next = "/dashboard"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.profile.role !== "admin") redirect("/dashboard");
  return user;
}

/** For server actions: returns the user or throws (no redirect side-effects). */
export async function assertUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in to continue.");
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertUser();
  if (user.profile.role !== "admin") throw new AuthError("Admin access required.");
  return user;
}

export class AuthError extends Error {}

export { safeNext } from "@/lib/redirect";
