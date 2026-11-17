"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { fail, formToObject, succeed, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { emailSchema, loginSchema, registerSchema } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { env, isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/auth";

const NOT_CONFIGURED = "Accounts are not available yet — the platform is still being configured.";

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = registerSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  if (!(await rateLimit(`signup:${ip}`, 5, 3600))) return fail("Too many sign-up attempts. Please try again later.");

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard`,
      data: { full_name: d.full_name, phone: d.phone ?? "", company_name: d.company_name ?? "" },
    },
  });
  if (error) {
    if (/password/i.test(error.message)) return fail(error.message, { password: error.message });
    console.error("signUp error", error.message);
    return fail("We couldn't create your account. Please try again.");
  }
  // Same response whether or not the email already exists (prevents account enumeration).
  return succeed("Check your inbox to confirm your email address, then sign in.", { email: d.email });
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = loginSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 20, 900))) return fail("Too many sign-in attempts. Please wait 15 minutes.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    if (error?.code === "email_not_confirmed") return fail("Please confirm your email address first — check your inbox.");
    return fail("Incorrect email or password.");
  }
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  const fallback = profile?.role === "admin" ? "/admin" : "/dashboard";
  redirect(safeNext(String(formData.get("next") ?? ""), fallback));
}

export async function requestPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail(NOT_CONFIGURED);
  const parsed = z.object({ email: emailSchema }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please enter a valid email.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  if (!(await rateLimit(`reset:${ip}`, 5, 3600))) return fail("Too many requests. Please try again later.");
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password`,
  });
  return succeed("If an account exists for that email, a reset link is on its way.");
}

export async function updatePassword(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password: registerSchema.shape.password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" })
    .safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(error.message.includes("session") ? "Your reset link has expired. Please request a new one." : error.message);
  redirect("/dashboard?password=updated");
}
