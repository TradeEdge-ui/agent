"use server";

import { randomUUID } from "node:crypto";
import { fail, formToObject, succeed, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { bookingSchema, contactSchema, quoteRequestSchema } from "@/lib/validation";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { emailLayout, sendEmail } from "@/lib/email";
import { emailOwner, notifyAdminsInApp } from "@/lib/notify";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/settings";
import { isSlotAvailable } from "@/lib/booking";
import { buildIcs } from "@/lib/ics";
import { formatDateTime } from "@/lib/dates";
import { env, isSupabaseConfigured } from "@/lib/env";

const NOT_READY = "Our booking system is being set up. Please email us directly in the meantime.";

function isBot(formData: FormData) {
  return Boolean(String(formData.get("website_hp") ?? "").trim());
}

export async function submitQuoteRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail(NOT_READY);
  if (isBot(formData)) return succeed("Thanks! We'll be in touch.");
  const parsed = quoteRequestSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  if (!(await rateLimit(`quote:${ip}`, 5, 3600))) return fail("Too many requests. Please try again in an hour or email us.");

  const d = parsed.data;
  const admin = createAdminClient();
  const user = await getCurrentUser();
  let serviceId: string | null = null;
  let serviceName = "Not sure yet";
  if (d.service_slug) {
    const { data: svc } = await admin.from("services").select("id,name").eq("slug", d.service_slug).maybeSingle();
    if (svc) {
      serviceId = svc.id;
      serviceName = svc.name;
    }
  }

  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      user_id: user && user.email.toLowerCase() === d.email ? user.id : null,
      name: d.name,
      email: d.email,
      phone: d.phone,
      company: d.company,
      source: "quote_request",
      service_id: serviceId,
      budget: d.budget,
      timeline: d.timeline,
      website_url: d.website_url,
      message: d.goals,
      details: { pages_or_features: d.pages_or_features, references: d.references },
    })
    .select("id")
    .single();
  if (error || !lead) {
    console.error("lead insert failed", error);
    return fail("We couldn't save your request. Please try again or email us.");
  }

  await notifyAdminsInApp(`New quote request: ${d.name}`, `${serviceName} · Budget: ${d.budget ?? "n/a"}`, `/admin/leads/${lead.id}`);
  await emailOwner(`New quote request from ${d.name}`, [
    `Service: ${serviceName}`, `Budget: ${d.budget ?? "n/a"} · Timeline: ${d.timeline ?? "n/a"}`, `Email: ${d.email} · Phone: ${d.phone ?? "n/a"}`, d.goals,
  ], `/admin/leads/${lead.id}`);

  const { html, text } = emailLayout({
    heading: "We've received your project request",
    paragraphs: [
      `Hi ${d.name}, thank you for contacting ARyzz AI Solutions about: ${serviceName}.`,
      "We'll review your requirements and reply by email — usually within one business day. If we need more details we'll ask before preparing your quotation.",
      "Create a free client account with this email address to receive your quotation, accept it and pay online.",
    ],
    cta: { label: "Create your client account", url: `${env.siteUrl}/register?email=${encodeURIComponent(d.email)}` },
  });
  await sendEmail({ to: d.email, subject: "We've received your project request", html, text });

  return succeed("Thank you! Your request has been received.", { email: d.email });
}

export async function submitContact(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail(NOT_READY);
  if (isBot(formData)) return succeed("Thanks! We'll be in touch.");
  const parsed = contactSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  if (!(await rateLimit(`contact:${ip}`, 5, 3600))) return fail("Too many messages. Please try again later.");

  const d = parsed.data;
  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("leads")
    .insert({ name: d.name, email: d.email, phone: d.phone, company: d.company, source: "contact", message: d.message })
    .select("id")
    .single();
  if (error || !lead) return fail("We couldn't send your message. Please try again.");

  await notifyAdminsInApp(`New message from ${d.name}`, d.message.slice(0, 200), `/admin/leads/${lead.id}`);
  await emailOwner(`Contact form: ${d.name}`, [`Email: ${d.email} · Phone: ${d.phone ?? "n/a"}`, d.message], `/admin/leads/${lead.id}`);
  return succeed("Thanks for your message — we'll reply by email soon.");
}

export async function createBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return fail(NOT_READY);
  if (isBot(formData)) return succeed("Booked.");
  const parsed = bookingSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const ip = await clientIp();
  if (!(await rateLimit(`booking:${ip}`, 4, 3600))) return fail("Too many booking attempts. Please try again later.");

  const d = parsed.data;
  const admin = createAdminClient();
  const settings = await getBusinessSettings();
  const { data: taken } = await admin
    .from("bookings")
    .select("start_at")
    .eq("status", "confirmed")
    .gte("start_at", new Date().toISOString());
  const slot = isSlotAvailable(settings.booking_config, (taken ?? []).map((t) => t.start_at), d.slot);
  if (!slot) return fail("Sorry, that time is no longer available. Please pick another slot.", { slot: "Pick another time" });

  // Same-email limit: avoid one person hoarding slots.
  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .ilike("email", d.email)
    .gte("start_at", new Date().toISOString());
  if ((count ?? 0) >= 2) return fail("You already have upcoming consultations booked. Please cancel one first or email us.");

  const user = await getCurrentUser();
  const { data: lead } = await admin
    .from("leads")
    .insert({
      user_id: user && user.email.toLowerCase() === d.email ? user.id : null,
      name: d.name, email: d.email, phone: d.phone, company: d.company, source: "booking",
      message: `Consultation: ${d.topic}${d.notes ? `\n\n${d.notes}` : ""}`,
    })
    .select("id")
    .single();

  const { data: booking, error } = await admin
    .from("bookings")
    .insert({
      user_id: user && user.email.toLowerCase() === d.email ? user.id : null,
      lead_id: lead?.id ?? null,
      name: d.name, email: d.email, phone: d.phone, company: d.company,
      topic: d.topic, notes: d.notes, start_at: slot.start, end_at: slot.end, status: "confirmed",
    })
    .select("id")
    .single();
  if (error || !booking) {
    if (error?.code === "23505") return fail("Someone just booked that slot. Please choose another time.", { slot: "Pick another time" });
    console.error("booking insert failed", error);
    return fail("We couldn't complete your booking. Please try again.");
  }

  const when = formatDateTime(slot.start);
  const ics = buildIcs({
    uid: `${booking.id}@aryzz`,
    start: new Date(slot.start),
    end: new Date(slot.end),
    summary: "Free consultation with ARyzz AI Solutions",
    description: `Topic: ${d.topic}. We'll email the video call link before the meeting.`,
    organizerEmail: settings.email ?? undefined,
  });
  const { html, text } = emailLayout({
    heading: "Your free consultation is booked",
    paragraphs: [
      `Hi ${d.name}, your consultation is confirmed for ${when} (Malaysia time).`,
      `Topic: ${d.topic}`,
      "We'll send the video call link before the meeting. Need to reschedule? Reply to this email.",
    ],
  });
  await sendEmail({
    to: d.email,
    subject: `Consultation booked: ${when}`,
    html,
    text,
    replyTo: settings.email ?? undefined,
    attachments: [{ filename: "consultation.ics", content: Buffer.from(ics).toString("base64"), contentType: "text/calendar" }],
  });
  await notifyAdminsInApp(`Consultation booked: ${when}`, `${d.name} — ${d.topic}`, "/admin/bookings");
  await emailOwner(`New consultation: ${when}`, [`${d.name} (${d.email}, ${d.phone ?? "no phone"})`, `Topic: ${d.topic}`, d.notes ?? ""], "/admin/bookings");

  return succeed(`You're booked for ${when}.`, { when, id: randomUUID() });
}
