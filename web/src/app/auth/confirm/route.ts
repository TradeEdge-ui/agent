import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

/**
 * Token-hash verification (works even when the link is opened on a different
 * device). Point the Supabase email templates at:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"), "/dashboard");
  const allowed: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];
  if (tokenHash && type && allowed.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${type === "recovery" ? "/reset-password" : next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
