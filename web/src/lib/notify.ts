import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailLayout, sendEmail, type EmailAttachment } from "@/lib/email";
import { env } from "@/lib/env";

/**
 * Records an in-app notification and (optionally) emails the user.
 * In-app notifications always work; email depends on RESEND_API_KEY.
 */
export async function notifyUser(opts: {
  userId: string;
  title: string;
  body: string;
  link?: string;
  email?: boolean;
  attachments?: EmailAttachment[];
}) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    user_id: opts.userId,
    title: opts.title,
    body: opts.body,
    link: opts.link ?? null,
  });
  if (opts.email === false) return;
  const { data: profile } = await admin.from("profiles").select("email").eq("id", opts.userId).single();
  if (!profile?.email) return;
  const { html, text } = emailLayout({
    heading: opts.title,
    paragraphs: [opts.body],
    cta: opts.link ? { label: "Open your dashboard", url: `${env.siteUrl}${opts.link}` } : undefined,
  });
  await sendEmail({ to: profile.email, subject: opts.title, html, text, attachments: opts.attachments });
}

/** Emails the owner (ADMIN_NOTIFICATION_EMAIL) — in-app admin alerts are created in SQL. */
export async function emailOwner(subject: string, paragraphs: string[], link?: string) {
  if (!env.adminNotificationEmail) return;
  const { html, text } = emailLayout({
    heading: subject,
    paragraphs,
    cta: link ? { label: "Open admin", url: `${env.siteUrl}${link}` } : undefined,
    footer: "Owner notification from your ARyzz platform.",
  });
  await sendEmail({ to: env.adminNotificationEmail, subject: `[ARyzz] ${subject}`, html, text });
}

export async function notifyAdminsInApp(title: string, body: string, link?: string) {
  const admin = createAdminClient();
  await admin.rpc("notify_admins", { p_title: title, p_body: body, p_link: link ?? null });
}
