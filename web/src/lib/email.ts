import "server-only";
import { env } from "@/lib/env";

export type EmailAttachment = { filename: string; content: string /* base64 */; contentType?: string };

export type SendResult = { sent: boolean; skipped?: string; error?: string };

/**
 * Sends a transactional email through Resend's HTTP API. When email is not
 * configured the message is NOT sent; the caller still records an in-app
 * notification, and the skip is logged so nothing fails silently.
 */
export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}): Promise<SendResult> {
  if (!env.resendApiKey || !env.emailFrom) {
    console.info(`[email skipped: not configured] to=${opts.to} subject="${opts.subject}"`);
    return { sent: false, skipped: "Email provider not configured" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.emailFrom,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo,
        attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content, content_type: a.contentType })),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Resend error", res.status, body.slice(0, 500));
      return { sent: false, error: `Email provider returned ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("Email send failed", e);
    return { sent: false, error: "Email send failed" };
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Simple, client-friendly branded layout. Body paragraphs are escaped. */
export function emailLayout(opts: { heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footer?: string }) {
  const paras = opts.paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.6;color:#1f2937">${escapeHtml(p)}</p>`).join("");
  const cta = opts.cta
    ? `<p style="margin:24px 0"><a href="${encodeURI(opts.cta.url)}" style="background:#6d28d9;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(opts.cta.label)}</a></p>`
    : "";
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px">
<tr><td>
<p style="margin:0 0 20px;font-weight:700;font-size:18px;color:#6d28d9">ARyzz AI Solutions</p>
<h1 style="margin:0 0 16px;font-size:20px;color:#111827">${escapeHtml(opts.heading)}</h1>
${paras}${cta}
<p style="margin:24px 0 0;font-size:12px;color:#6b7280">${escapeHtml(opts.footer ?? "You are receiving this email because of your enquiry or account with ARyzz AI Solutions.")}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = [opts.heading, "", ...opts.paragraphs, ...(opts.cta ? ["", `${opts.cta.label}: ${opts.cta.url}`] : [])].join("\n");
  return { html, text };
}
