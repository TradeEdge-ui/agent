import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { emailOwner, notifyUser } from "@/lib/notify";
import { formatMYR } from "@/lib/money";
import { formatDateTime, todayMY } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  if (!env.cronSecret) return false;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${env.cronSecret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily routine admin automation (Vercel Cron). It only does reversible,
 * routine work: expiring stale quotes, gentle payment reminders, and an owner
 * digest. It never changes prices, issues refunds or cancels anything paid.
 */
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const today = todayMY();
  const summary: string[] = [];

  // 1. Expire quotations past their validity date.
  const { data: expired } = await admin.from("quotes").update({ status: "expired" }).eq("status", "sent").lt("valid_until", today).select("id");
  if (expired?.length) summary.push(`${expired.length} quotation(s) expired.`);

  // 2. Overdue invoice reminders (max once every 3 days per invoice).
  const { data: settings } = await admin.from("business_settings").select("auto_payment_reminders").eq("id", 1).single();
  if (settings?.auto_payment_reminders) {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const { data: overdue } = await admin
      .from("invoices")
      .select("id,number,client_id,total_cents,amount_paid_cents,due_date,last_reminder_at")
      .eq("status", "open")
      .lt("due_date", today)
      .or(`last_reminder_at.is.null,last_reminder_at.lt.${threeDaysAgo}`)
      .limit(50);
    for (const inv of overdue ?? []) {
      await notifyUser({
        userId: inv.client_id,
        title: `Payment reminder: invoice ${inv.number}`,
        body: `Invoice ${inv.number} (${formatMYR(inv.total_cents - inv.amount_paid_cents)}) was due on ${inv.due_date}. If you've already paid by bank transfer, please ignore this message — we'll confirm shortly.`,
        link: `/dashboard/invoices/${inv.id}`,
      });
      await admin.from("invoices").update({ last_reminder_at: new Date().toISOString() }).eq("id", inv.id);
    }
    if (overdue?.length) summary.push(`${overdue.length} payment reminder(s) sent.`);
  }

  // 3. Owner digest.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const [{ data: leads }, { data: bookings }, { data: openInv }] = await Promise.all([
    admin.from("leads").select("name,source").gte("created_at", since),
    admin.from("bookings").select("name,topic,start_at").eq("status", "confirmed").gte("start_at", new Date().toISOString()).lt("start_at", tomorrow).order("start_at"),
    admin.from("invoices").select("total_cents,amount_paid_cents,due_date").eq("status", "open"),
  ]);
  const outstanding = (openInv ?? []).reduce((s, i) => s + i.total_cents - i.amount_paid_cents, 0);
  const lines = [
    `New leads (24h): ${leads?.length ?? 0}${leads?.length ? ` — ${leads.map((l) => l.name).join(", ")}` : ""}`,
    `Consultations in the next 48h: ${bookings?.length ? bookings.map((b) => `${formatDateTime(b.start_at)} ${b.name}`).join("; ") : "none"}`,
    `Outstanding invoices: ${formatMYR(outstanding)}`,
    ...summary,
  ];
  if ((leads?.length ?? 0) > 0 || (bookings?.length ?? 0) > 0 || summary.length) {
    await emailOwner(`Daily digest — ${today}`, lines, "/admin");
  }
  return Response.json({ ok: true, summary: lines });
}
