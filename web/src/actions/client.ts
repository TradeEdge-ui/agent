"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorMessage, fail, formToObject, succeed, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { assertUser, AuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { commentSchema, profileSchema, projectRequestSchema, revisionSchema, testimonialSchema } from "@/lib/validation";
import { getStripe, isStripeConfigured, StripeNotConfiguredError } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { buildInvoiceCheckoutParams, buildSubscriptionCheckoutParams } from "@/lib/stripe/params";
import { amountDue } from "@/lib/invoice-math";
import { emailOwner, notifyAdminsInApp } from "@/lib/notify";
import { env } from "@/lib/env";
import type { Invoice, Service } from "@/lib/types";

async function guard<T>(fn: () => Promise<T>): Promise<T | ActionState> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError || e instanceof StripeNotConfiguredError) return fail(e.message);
    throw e;
  }
}

// ------------------------------------------------------------------ profile
export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const parsed = profileSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/dashboard", "layout");
  return succeed("Profile saved.");
}

// --------------------------------------------------------- project requests
export async function createProjectRequest(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const parsed = projectRequestSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const d = parsed.data;
  const admin = createAdminClient();
  let serviceId: string | null = null;
  if (d.service_slug) {
    const { data } = await admin.from("services").select("id").eq("slug", d.service_slug).maybeSingle();
    serviceId = data?.id ?? null;
  }
  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      user_id: user.id,
      name: user.profile.full_name ?? user.email,
      email: user.email,
      phone: user.profile.phone,
      company: user.profile.company_name,
      source: "dashboard",
      service_id: serviceId,
      budget: d.budget,
      timeline: d.timeline,
      website_url: d.website_url,
      message: `${d.title}\n\n${d.goals}`,
    })
    .select("id")
    .single();
  if (error || !lead) return fail("We couldn't save your request. Please try again.");
  await notifyAdminsInApp(`New request from ${user.profile.full_name ?? user.email}`, d.title, `/admin/leads/${lead.id}`);
  await emailOwner(`New client request: ${d.title}`, [`From: ${user.email}`, d.goals], `/admin/leads/${lead.id}`);
  revalidatePath("/dashboard/requests");
  return succeed("Request sent. We'll prepare a quotation and notify you here.", { leadId: lead.id });
}

// ----------------------------------------------------------------- quotes
export async function acceptQuote(formData: FormData) {
  await assertUser();
  const quoteId = z.uuid().parse(formData.get("quote_id"));
  if (formData.get("agree") !== "on") redirect(`/dashboard/quotes/${quoteId}?error=agree`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_quote", { p_quote_id: quoteId });
  if (error) redirect(`/dashboard/quotes/${quoteId}?error=${encodeURIComponent(dbErrorMessage(error))}`);
  const res = data as { project_id: string; invoice_id: string };
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/invoices/${res.invoice_id}?accepted=1`);
}

export async function declineQuote(formData: FormData) {
  await assertUser();
  const quoteId = z.uuid().parse(formData.get("quote_id"));
  const reason = String(formData.get("reason") ?? "").slice(0, 2000);
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_quote", { p_quote_id: quoteId, p_reason: reason });
  if (error) redirect(`/dashboard/quotes/${quoteId}?error=${encodeURIComponent(dbErrorMessage(error))}`);
  revalidatePath("/dashboard/quotes");
  redirect(`/dashboard/quotes/${quoteId}`);
}

// ------------------------------------------------------- invoice checkout
/**
 * Creates (or reuses) a Stripe Checkout Session for an open invoice. The
 * amount is the invoice's outstanding balance read from our database.
 */
async function checkoutUrlForInvoice(invoiceId: string): Promise<string> {
  const user = await assertUser();
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
  const invoice = inv as Invoice | null;
  if (!invoice || invoice.client_id !== user.id) throw new AuthError("Invoice not found.");
  if (invoice.status !== "open") throw new AuthError("This invoice is not open for payment.");
  const due = amountDue(invoice);
  if (due <= 0) throw new AuthError("This invoice has no outstanding balance.");

  const stripe = getStripe();
  const admin = createAdminClient();

  if (invoice.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(invoice.stripe_checkout_session_id);
      if (existing.status === "open" && existing.amount_total === due && existing.url) return existing.url;
      if (existing.status === "complete") {
        throw new AuthError("A payment for this invoice is already being processed. Please refresh in a minute.");
      }
    } catch (e) {
      if (e instanceof AuthError) throw e;
      // Session missing/expired: create a new one below.
    }
  }

  const customerId = await ensureStripeCustomer(user.profile);
  const session = await stripe.checkout.sessions.create(
    buildInvoiceCheckoutParams({
      siteUrl: env.siteUrl,
      customerId,
      invoice: { id: invoice.id, number: invoice.number, title: invoice.title, client_id: invoice.client_id },
      amountDueCents: due,
    }),
    { idempotencyKey: `inv-${invoice.id}-${due}-${Math.floor(Date.now() / 60_000)}` },
  );
  await admin.from("invoices").update({ stripe_checkout_session_id: session.id }).eq("id", invoice.id);
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

export async function payInvoice(formData: FormData) {
  const invoiceId = z.uuid().parse(formData.get("invoice_id"));
  let url: string;
  try {
    url = await checkoutUrlForInvoice(invoiceId);
  } catch (e) {
    const msg = e instanceof AuthError || e instanceof StripeNotConfiguredError ? e.message : "Could not start the payment. Please try again.";
    if (!(e instanceof AuthError || e instanceof StripeNotConfiguredError)) console.error("checkout error", e);
    redirect(`/dashboard/invoices/${invoiceId}?error=${encodeURIComponent(msg)}`);
  }
  redirect(url);
}

// ------------------------------------------------------ direct online order
export async function placeDirectOrder(formData: FormData) {
  const user = await assertUser();
  const slug = z.string().min(1).max(80).parse(formData.get("slug"));
  if (formData.get("agree") !== "on") redirect(`/order/${slug}?error=agree`);
  const notes = String(formData.get("notes") ?? "").slice(0, 5000);
  const supabase = await createClient();
  const { data: svc } = await supabase.from("services").select("id").eq("slug", slug).single();
  if (!svc) redirect("/services");
  const { data, error } = await supabase.rpc("create_direct_order", { p_service_id: svc.id, p_notes: notes || null });
  if (error) redirect(`/order/${slug}?error=${encodeURIComponent(dbErrorMessage(error))}`);
  const res = data as { project_id: string; invoice_id: string };
  await emailOwner(`New online order: ${slug}`, [`Client: ${user.email}`, notes ? `Notes: ${notes}` : "No notes"], `/admin/projects/${res.project_id}`);
  revalidatePath("/dashboard", "layout");

  if (!isStripeConfigured()) redirect(`/dashboard/invoices/${res.invoice_id}?ordered=1`);
  let url: string;
  try {
    url = await checkoutUrlForInvoice(res.invoice_id);
  } catch (e) {
    console.error("order checkout error", e);
    redirect(`/dashboard/invoices/${res.invoice_id}?ordered=1&error=${encodeURIComponent("Could not open the payment page. Please click Pay now to try again.")}`);
  }
  redirect(url);
}

// ----------------------------------------------------------- subscriptions
export async function startSubscription(formData: FormData) {
  const user = await assertUser();
  const slug = z.string().min(1).max(80).parse(formData.get("slug"));
  if (formData.get("agree") !== "on") redirect(`/order/${slug}?error=agree`);
  const projectId = z.uuid().optional().or(z.literal("")).parse(formData.get("project_id") ?? "") || null;
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("slug", slug).single();
  const service = data as Service | null;
  if (!service || service.billing_type !== "monthly" || service.purchase_mode !== "direct" || !service.price_min_cents) {
    redirect(`/order/${slug}?error=${encodeURIComponent("This plan is not available for online subscription.")}`);
  }
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("client_id", user.id)
    .eq("service_id", service.id)
    .in("status", ["active", "trialing", "past_due", "incomplete"])
    .limit(1);
  if (existing && existing.length) redirect(`/dashboard/subscriptions?error=${encodeURIComponent("You already have this plan.")}`);
  if (projectId) {
    const { data: proj } = await supabase.from("projects").select("id").eq("id", projectId).eq("client_id", user.id).single();
    if (!proj) redirect(`/order/${slug}?error=project`);
  }

  let url: string;
  try {
    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(user.profile);
    const session = await stripe.checkout.sessions.create(
      buildSubscriptionCheckoutParams({
        siteUrl: env.siteUrl,
        customerId,
        clientId: user.id,
        service: { id: service.id, name: service.name, price_min_cents: service.price_min_cents! },
        projectId,
      }),
      { idempotencyKey: `sub-${user.id}-${service.id}-${Math.floor(Date.now() / 60_000)}` },
    );
    url = session.url!;
  } catch (e) {
    const msg = e instanceof StripeNotConfiguredError ? e.message : "Could not start the subscription. Please try again.";
    if (!(e instanceof StripeNotConfiguredError)) console.error("subscription checkout error", e);
    redirect(`/order/${slug}?error=${encodeURIComponent(msg)}`);
  }
  redirect(url);
}

async function syncAfterStripeUpdate(subscriptionId: string) {
  // Mirror Stripe's authoritative response immediately (webhook will confirm).
  const stripe = getStripe();
  const { syncSubscription } = await import("@/lib/stripe/webhook");
  const admin = createAdminClient();
  await syncSubscription(subscriptionId, {
    stripe,
    db: {
      rpc: async (fn, args) => {
        const r = await admin.rpc(fn, args);
        return { data: r.data, error: r.error };
      },
      findClientIdByCustomer: async (customerId) => {
        const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customerId).maybeSingle();
        return data?.id ?? null;
      },
    },
  });
}

export async function setSubscriptionCancellation(_: ActionState, formData: FormData): Promise<ActionState> {
  const result = await guard(async () => {
    const user = await assertUser();
    const id = z.uuid().parse(formData.get("subscription_id"));
    const cancel = formData.get("cancel") === "true";
    const supabase = await createClient();
    const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).single();
    if (!sub || sub.client_id !== user.id || !sub.stripe_subscription_id) return fail("Subscription not found.");
    if (!["active", "trialing", "past_due"].includes(sub.status)) return fail("This subscription can no longer be changed.");
    const stripe = getStripe();
    await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: cancel });
    await syncAfterStripeUpdate(sub.stripe_subscription_id);
    await notifyAdminsInApp(
      cancel ? `Cancellation scheduled: ${sub.plan_name}` : `Cancellation withdrawn: ${sub.plan_name}`,
      `${user.profile.full_name ?? user.email}`,
      "/admin/subscriptions",
    );
    revalidatePath("/dashboard/subscriptions");
    return succeed(cancel ? "Your plan will end at the close of the current billing period." : "Your plan will continue to renew.");
  });
  return result as ActionState;
}

export async function openBillingPortal() {
  const user = await assertUser();
  let url: string;
  try {
    const stripe = getStripe();
    const customerId = await ensureStripeCustomer(user.profile);
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${env.siteUrl}/dashboard/subscriptions` });
    url = portal.url;
  } catch (e) {
    console.error("billing portal error", e);
    redirect(`/dashboard/subscriptions?error=${encodeURIComponent("The billing portal is not available right now.")}`);
  }
  redirect(url);
}

// ---------------------------------------------------- project collaboration
export async function requestRevision(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const parsed = revisionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("revision_requests").insert({ ...parsed.data, requested_by: user.id, status: "open" });
  if (error) return fail("Revisions can be requested while your project is active. Contact us if you need help.");
  const { data: p } = await supabase.from("projects").select("number,name").eq("id", parsed.data.project_id).single();
  await notifyAdminsInApp(`Revision request: ${p?.number ?? "project"}`, parsed.data.title, `/admin/projects/${parsed.data.project_id}`);
  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`);
  return succeed("Revision request sent.");
}

export async function postProjectMessage(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const parsed = commentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please write a message.", zodFieldErrors(parsed.error));
  const supabase = await createClient();
  const { error } = await supabase.from("project_updates").insert({ ...parsed.data, author_id: user.id, is_internal: false });
  if (error) return fail(dbErrorMessage(error));
  await notifyAdminsInApp(`Client message on project`, parsed.data.body.slice(0, 160), `/admin/projects/${parsed.data.project_id}`);
  revalidatePath(`/dashboard/projects/${parsed.data.project_id}`);
  return succeed("Message sent.");
}

const fileSchema = z.object({
  path: z.string().min(3).max(500),
  filename: z.string().min(1).max(255),
  size: z.coerce.number().int().min(0).max(26_214_400),
  mime: z.string().max(150).optional(),
  project_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

/** Records metadata for a file the browser uploaded directly to private storage. */
export async function registerUploadedFile(input: z.input<typeof fileSchema>): Promise<ActionState> {
  const user = await assertUser();
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid file.");
  const d = parsed.data;
  if (!d.path.startsWith(`${user.id}/`) || d.path.includes("..")) return fail("Invalid file path.");
  const admin = createAdminClient();
  const folder = d.path.slice(0, d.path.lastIndexOf("/"));
  const name = d.path.slice(d.path.lastIndexOf("/") + 1);
  const { data: listed } = await admin.storage.from("project-files").list(folder, { search: name, limit: 1 });
  if (!listed?.some((f) => f.name === name)) return fail("Upload not found. Please try again.");
  const supabase = await createClient();
  const { error } = await supabase.from("files").insert({
    owner_id: user.id,
    uploaded_by: user.id,
    project_id: d.project_id,
    path: d.path,
    filename: d.filename,
    size_bytes: d.size,
    mime_type: d.mime ?? null,
    kind: "asset",
  });
  if (error) return fail(dbErrorMessage(error, "Could not save the file."));
  if (d.project_id) {
    await notifyAdminsInApp("Client uploaded a file", d.filename, `/admin/projects/${d.project_id}`);
    revalidatePath(`/dashboard/projects/${d.project_id}`);
  }
  revalidatePath("/dashboard/files");
  return succeed("File uploaded.");
}

// ------------------------------------------------------------- misc client
export async function markAllNotificationsRead() {
  const user = await assertUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  revalidatePath("/", "layout");
}

export async function cancelMyBooking(formData: FormData) {
  await assertUser();
  const id = z.uuid().parse(formData.get("booking_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_booking", { p_booking_id: id });
  revalidatePath("/dashboard/bookings");
  redirect(`/dashboard/bookings${error ? `?error=${encodeURIComponent(dbErrorMessage(error))}` : "?cancelled=1"}`);
}

export async function submitTestimonial(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await assertUser();
  const parsed = testimonialSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the highlighted fields.", zodFieldErrors(parsed.error));
  const { consent, ...rest } = parsed.data;
  void consent;
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").insert({
    ...rest,
    submitted_by: user.id,
    consent_to_publish: true,
    is_published: false,
  });
  if (error) return fail(dbErrorMessage(error));
  await notifyAdminsInApp("New testimonial submitted", rest.quote.slice(0, 160), "/admin/testimonials");
  return succeed("Thank you! We'll review it before publishing.");
}
