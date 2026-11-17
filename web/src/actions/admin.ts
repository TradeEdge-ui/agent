"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { dbErrorMessage, fail, formToObject, succeed, zodFieldErrors, type ActionState } from "@/lib/action-state";
import { assertAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  emailSchema, expenseSchema, lineItemSchema, manualPaymentSchema, quoteEditorSchema, serviceEditorSchema,
} from "@/lib/validation";
import { computeTotals } from "@/lib/invoice-math";
import { parseRinggit, formatMYR } from "@/lib/money";
import { addDays, formatDateTime, todayMY } from "@/lib/dates";
import { notifyUser } from "@/lib/notify";
import { emailLayout, sendEmail } from "@/lib/email";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { getBusinessSettings } from "@/lib/settings";
import { env } from "@/lib/env";

async function audit(action: string, entity: string, entityId: string, details: Record<string, unknown> = {}) {
  const user = await assertAdmin();
  await createAdminClient().from("audit_log").insert({ actor_id: user.id, action, entity, entity_id: entityId, details });
}

function revalidateMarketing() {
  for (const p of ["/", "/services", "/pricing", "/portfolio"]) revalidatePath(p);
  revalidatePath("/services/[slug]", "page");
}

// ------------------------------------------------------------------- leads
export async function updateLead(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const d = z.object({
    lead_id: z.uuid(),
    status: z.enum(["new", "contacted", "qualified", "proposal_sent", "won", "lost"]),
    internal_notes: z.string().max(10000).optional(),
  }).safeParse(formToObject(formData));
  if (!d.success) return fail("Invalid input.");
  const supabase = await createClient();
  const { error } = await supabase.from("leads").update({ status: d.data.status }).eq("id", d.data.lead_id);
  if (error) return fail(dbErrorMessage(error));
  if (d.data.internal_notes !== undefined) {
    await supabase.from("lead_insights").upsert({ lead_id: d.data.lead_id, internal_notes: d.data.internal_notes || null });
  }
  revalidatePath(`/admin/leads/${d.data.lead_id}`);
  revalidatePath("/admin/leads");
  return succeed("Lead updated.");
}

/** Saves an AI qualification the owner has reviewed (advisory only). */
export async function saveLeadQualification(leadId: string, score: number, summary: string, qualification: unknown): Promise<ActionState> {
  await assertAdmin();
  if (!z.uuid().safeParse(leadId).success) return fail("Invalid lead.");
  const supabase = await createClient();
  const { error } = await supabase.from("lead_insights").upsert({
    lead_id: leadId,
    ai_score: Math.max(0, Math.min(100, Math.round(score))),
    ai_summary: summary.slice(0, 5000),
    ai_qualification: qualification,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/admin/leads/${leadId}`);
  return succeed("Saved to lead.");
}

export async function createManualLead(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const d = z.object({
    name: z.string().trim().min(2).max(120),
    email: emailSchema,
    phone: z.string().trim().max(40).optional(),
    company: z.string().trim().max(160).optional(),
    message: z.string().trim().min(3).max(5000),
  }).safeParse(formToObject(formData));
  if (!d.success) return fail("Please check the fields.", zodFieldErrors(d.error));
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").insert({ ...d.data, phone: d.data.phone || null, company: d.data.company || null, source: "manual" }).select("id").single();
  if (error || !data) return fail(dbErrorMessage(error));
  redirect(`/admin/leads/${data.id}`);
}

// ---------------------------------------------------------------- services
export async function saveService(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return fail("Invalid form data.");
  }
  const id = z.uuid().optional().safeParse((payload as { id?: string }).id);
  const parsed = serviceEditorSchema.safeParse(payload);
  if (!parsed.success || !id.success) return fail("Please check the highlighted fields.", parsed.success ? undefined : zodFieldErrors(parsed.error));
  const supabase = await createClient();
  const res = id.data
    ? await supabase.from("services").update(parsed.data).eq("id", id.data).select("id").single()
    : await supabase.from("services").insert(parsed.data).select("id").single();
  if (res.error) return fail(res.error.code === "23505" ? "That slug is already used." : dbErrorMessage(res.error));
  await audit(id.data ? "service.updated" : "service.created", "service", res.data.id, { slug: parsed.data.slug, price_min_cents: parsed.data.price_min_cents });
  revalidateMarketing();
  revalidatePath("/admin/services");
  return succeed("Service saved. The website updates within a few minutes.", { id: res.data.id });
}

// ------------------------------------------------------------------ quotes
export async function saveQuote(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return fail("Invalid form data.");
  }
  const id = z.uuid().optional().safeParse(payload.id);
  const parsed = quoteEditorSchema.safeParse(payload);
  if (!parsed.success || !id.success) return fail("Please fix the highlighted fields.", parsed.success ? undefined : zodFieldErrors(parsed.error));
  const q = parsed.data;
  const totals = computeTotals(q.line_items, q.discount_cents, q.tax_rate);
  const supabase = await createClient();
  const { data: client } = await createAdminClient().from("profiles").select("id").ilike("email", q.client_email).maybeSingle();

  const row = { ...q, ...totals, client_id: client?.id ?? null };
  if (id.data) {
    const { data: existing } = await supabase.from("quotes").select("status").eq("id", id.data).single();
    if (!existing || existing.status !== "draft") return fail("Only draft quotations can be edited. Duplicate it to make changes.");
    const { error } = await supabase.from("quotes").update(row).eq("id", id.data);
    if (error) return fail(dbErrorMessage(error));
    revalidatePath(`/admin/quotes/${id.data}`);
    return succeed("Draft saved.", { id: id.data });
  }
  const { data, error } = await supabase.from("quotes").insert({ ...row, created_by: admin.id, status: "draft" }).select("id").single();
  if (error || !data) return fail(dbErrorMessage(error));
  redirect(`/admin/quotes/${data.id}?saved=1`);
}

export async function sendQuote(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("quote_id"));
  const supabase = await createClient();
  const settings = await getBusinessSettings();
  const { data: q } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!q || q.status !== "draft") redirect(`/admin/quotes/${id}?error=${encodeURIComponent("Only drafts can be sent.")}`);
  if (q.total_cents <= 0) redirect(`/admin/quotes/${id}?error=${encodeURIComponent("Add at least one priced line item.")}`);
  const admin = createAdminClient();
  const { data: client } = await admin.from("profiles").select("id").ilike("email", q.client_email).maybeSingle();
  const validUntil = q.valid_until ?? addDays(todayMY(), settings.quote_validity_days);
  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: new Date().toISOString(), valid_until: validUntil, client_id: client?.id ?? q.client_id })
    .eq("id", id);
  if (error) redirect(`/admin/quotes/${id}?error=${encodeURIComponent(dbErrorMessage(error))}`);
  if (q.lead_id) await supabase.from("leads").update({ status: "proposal_sent" }).eq("id", q.lead_id);

  const clientId = client?.id ?? q.client_id;
  if (clientId) {
    await notifyUser({
      userId: clientId,
      title: `Your quotation ${q.number} is ready`,
      body: `"${q.title}" — ${formatMYR(q.total_cents)}. Review and accept it online; it is valid until ${validUntil}.`,
      link: `/dashboard/quotes/${id}`,
    });
  } else {
    const { html, text } = emailLayout({
      heading: `Your quotation ${q.number} is ready`,
      paragraphs: [
        `Hi ${q.client_name ?? "there"}, your quotation "${q.title}" (${formatMYR(q.total_cents)}) is ready.`,
        `Create your free client account with this email address (${q.client_email}) to review, accept and pay securely online. The quotation is valid until ${validUntil}.`,
      ],
      cta: { label: "Create account & view quotation", url: `${env.siteUrl}/register?email=${encodeURIComponent(q.client_email)}` },
    });
    await sendEmail({ to: q.client_email, subject: `Your quotation ${q.number} from ARyzz AI Solutions`, html, text, replyTo: settings.email ?? undefined });
  }
  await audit("quote.sent", "quote", id, { total_cents: q.total_cents });
  revalidatePath(`/admin/quotes/${id}`);
  redirect(`/admin/quotes/${id}?sent=1`);
}

export async function cancelQuote(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("quote_id"));
  const supabase = await createClient();
  await supabase.from("quotes").update({ status: "cancelled" }).in("status", ["draft", "sent"]).eq("id", id);
  await audit("quote.cancelled", "quote", id);
  revalidatePath(`/admin/quotes/${id}`);
  redirect(`/admin/quotes/${id}`);
}

export async function duplicateQuote(formData: FormData) {
  const user = await assertAdmin();
  const id = z.uuid().parse(formData.get("quote_id"));
  const supabase = await createClient();
  const { data: q } = await supabase.from("quotes").select("*").eq("id", id).single();
  if (!q) redirect("/admin/quotes");
  const copy = {
    lead_id: q.lead_id, client_id: q.client_id, client_email: q.client_email, client_name: q.client_name, service_id: q.service_id,
    title: q.title, summary: q.summary, line_items: q.line_items, subtotal_cents: q.subtotal_cents, discount_cents: q.discount_cents,
    tax_rate: q.tax_rate, tax_cents: q.tax_cents, total_cents: q.total_cents, payment_schedule: q.payment_schedule,
    deliverables: q.deliverables, exclusions: q.exclusions, revisions_included: q.revisions_included, timeline_text: q.timeline_text,
    recommended_service_id: q.recommended_service_id, terms: q.terms, status: "draft", created_by: user.id,
  };
  const { data } = await supabase.from("quotes").insert(copy).select("id").single();
  redirect(`/admin/quotes/${data?.id ?? id}`);
}

// ---------------------------------------------------------------- invoices
export async function createManualInvoice(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return fail("Invalid form data.");
  }
  const parsed = z.object({
    client_id: z.uuid({ message: "Choose a client" }),
    project_id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    title: z.string().trim().min(3).max(300),
    line_items: z.array(lineItemSchema).min(1).max(50),
    discount_cents: z.coerce.number().int().min(0).default(0),
    tax_rate: z.coerce.number().min(0).max(100).default(0),
    due_date: z.iso.date().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    notes: z.string().max(5000).optional(),
    issue_now: z.boolean().default(false),
  }).safeParse(payload);
  if (!parsed.success) return fail("Please fix the highlighted fields.", zodFieldErrors(parsed.error));
  const d = parsed.data;
  const totals = computeTotals(d.line_items, d.discount_cents, d.tax_rate);
  if (totals.total_cents <= 0) return fail("Invoice total must be greater than zero.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      client_id: d.client_id, project_id: d.project_id, kind: "manual", title: d.title, line_items: d.line_items,
      ...totals, tax_rate: d.tax_rate, due_date: d.due_date, notes: d.notes || null, status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) return fail(dbErrorMessage(error));
  if (d.issue_now) await issueInvoiceInternal(data.id);
  redirect(`/admin/invoices/${data.id}`);
}

async function issueInvoiceInternal(id: string) {
  const supabase = await createClient();
  const settings = await getBusinessSettings();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (!inv || inv.status !== "draft") return "Only draft invoices can be issued.";
  const due = inv.due_date ?? addDays(todayMY(), settings.invoice_due_days);
  const { error } = await supabase.from("invoices").update({ status: "open", issued_at: new Date().toISOString(), due_date: due }).eq("id", id);
  if (error) return dbErrorMessage(error);
  await notifyUser({
    userId: inv.client_id,
    title: `Invoice ${inv.number} issued`,
    body: `${inv.title} — ${formatMYR(inv.total_cents)} due by ${due}. Pay online by card or FPX from your dashboard.`,
    link: `/dashboard/invoices/${id}`,
  });
  await audit("invoice.issued", "invoice", id, { total_cents: inv.total_cents });
  return null;
}

export async function issueInvoice(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("invoice_id"));
  const err = await issueInvoiceInternal(id);
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}${err ? `?error=${encodeURIComponent(err)}` : "?issued=1"}`);
}

export async function voidInvoice(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("invoice_id"));
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("status,amount_paid_cents,stripe_checkout_session_id").eq("id", id).single();
  if (!inv || !["draft", "open"].includes(inv.status) || inv.amount_paid_cents > 0) {
    redirect(`/admin/invoices/${id}?error=${encodeURIComponent("Only unpaid draft/open invoices can be voided.")}`);
  }
  if (inv.stripe_checkout_session_id && isStripeConfigured()) {
    try {
      const s = await getStripe().checkout.sessions.retrieve(inv.stripe_checkout_session_id);
      if (s.status === "open") await getStripe().checkout.sessions.expire(inv.stripe_checkout_session_id);
    } catch (e) {
      console.error("Could not expire checkout session", e);
    }
  }
  await supabase.from("invoices").update({ status: "void", voided_at: new Date().toISOString() }).eq("id", id);
  await audit("invoice.voided", "invoice", id);
  revalidatePath(`/admin/invoices/${id}`);
  redirect(`/admin/invoices/${id}`);
}

export async function recordManualPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = manualPaymentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const amount = parseRinggit(parsed.data.amount);
  if (!amount || amount <= 0) return fail("Enter a valid amount.", { amount: "Enter a valid amount in RM" });
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_payment", {
    p_invoice_id: parsed.data.invoice_id,
    p_amount: amount,
    p_method: parsed.data.method,
    p_reference: parsed.data.reference,
    p_paid_at: new Date(`${parsed.data.paid_on}T12:00:00+08:00`).toISOString(),
  });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/admin/invoices/${parsed.data.invoice_id}`);
  return succeed(`Payment of ${formatMYR(amount)} recorded and receipt issued.`);
}

export async function sendInvoiceReminder(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("invoice_id"));
  const supabase = await createClient();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single();
  if (inv && inv.status === "open") {
    await notifyUser({
      userId: inv.client_id,
      title: `Reminder: invoice ${inv.number}`,
      body: `A friendly reminder that ${formatMYR(inv.total_cents - inv.amount_paid_cents)} is due${inv.due_date ? ` by ${inv.due_date}` : ""}. You can pay online in seconds.`,
      link: `/dashboard/invoices/${id}`,
    });
    await createAdminClient().from("invoices").update({ last_reminder_at: new Date().toISOString() }).eq("id", id);
  }
  redirect(`/admin/invoices/${id}?reminded=1`);
}

// ---------------------------------------------------------------- projects
export async function updateProject(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    project_id: z.uuid(),
    name: z.string().trim().min(2).max(200),
    status: z.enum(["awaiting_payment", "planning", "in_progress", "review", "completed", "on_hold", "cancelled"]),
    progress: z.coerce.number().int().min(0).max(100),
    start_date: z.iso.date().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    due_date: z.iso.date().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    revisions_included: z.coerce.number().int().min(0).max(50),
    staging_url: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
    live_url: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
    notify: z.literal("on").optional(),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const { project_id, notify, ...rest } = parsed.data;
  for (const u of [rest.staging_url, rest.live_url]) {
    if (u && !/^https?:\/\//i.test(u)) return fail("URLs must start with https://");
  }
  const supabase = await createClient();
  const { data: before } = await supabase.from("projects").select("status,client_id,name").eq("id", project_id).single();
  const { error } = await supabase.from("projects").update(rest).eq("id", project_id);
  if (error) return fail(dbErrorMessage(error));
  if (notify && before) {
    await notifyUser({
      userId: before.client_id,
      title: `Project update: ${rest.name}`,
      body: before.status !== rest.status ? `Status changed to "${rest.status.replace("_", " ")}". Progress: ${rest.progress}%.` : `Progress is now ${rest.progress}%.`,
      link: `/dashboard/projects/${project_id}`,
    });
  }
  revalidatePath(`/admin/projects/${project_id}`);
  return succeed("Project saved.");
}

export async function addMilestone(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    project_id: z.uuid(),
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000).optional(),
    due_date: z.iso.date().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const supabase = await createClient();
  const { count } = await supabase.from("milestones").select("id", { count: "exact", head: true }).eq("project_id", parsed.data.project_id);
  const { error } = await supabase.from("milestones").insert({ ...parsed.data, description: parsed.data.description || null, sort_order: (count ?? 0) + 1 });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  return succeed("Milestone added.");
}

export async function setMilestoneStatus(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("milestone_id"));
  const projectId = z.uuid().parse(formData.get("project_id"));
  const status = z.enum(["pending", "in_progress", "completed"]).parse(formData.get("status"));
  const supabase = await createClient();
  await supabase.from("milestones").update({ status, completed_at: status === "completed" ? new Date().toISOString() : null }).eq("id", id);
  // Keep progress in sync with completed milestones.
  const { data: all } = await supabase.from("milestones").select("status").eq("project_id", projectId);
  if (all?.length) {
    const pct = Math.round((all.filter((m) => m.status === "completed").length / all.length) * 100);
    await supabase.from("projects").update({ progress: pct }).eq("id", projectId);
  }
  if (status === "completed") {
    const { data: p } = await supabase.from("projects").select("client_id,name").eq("id", projectId).single();
    const { data: m } = await supabase.from("milestones").select("title").eq("id", id).single();
    if (p && m) await notifyUser({ userId: p.client_id, title: `Milestone completed: ${m.title}`, body: `On ${p.name}.`, link: `/dashboard/projects/${projectId}` });
  }
  revalidatePath(`/admin/projects/${projectId}`);
  redirect(`/admin/projects/${projectId}`);
}

export async function postProjectUpdate(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const parsed = z.object({
    project_id: z.uuid(),
    body: z.string().trim().min(1).max(10000),
    is_internal: z.literal("on").optional(),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Write an update first.");
  const internal = parsed.data.is_internal === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("project_updates").insert({ project_id: parsed.data.project_id, body: parsed.data.body, is_internal: internal, author_id: admin.id });
  if (error) return fail(dbErrorMessage(error));
  if (!internal) {
    const { data: p } = await supabase.from("projects").select("client_id,name").eq("id", parsed.data.project_id).single();
    if (p) await notifyUser({ userId: p.client_id, title: `New update on ${p.name}`, body: parsed.data.body.slice(0, 500), link: `/dashboard/projects/${parsed.data.project_id}` });
  }
  revalidatePath(`/admin/projects/${parsed.data.project_id}`);
  return succeed(internal ? "Internal note saved." : "Update posted and client notified.");
}

export async function respondRevision(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    revision_id: z.uuid(),
    project_id: z.uuid(),
    status: z.enum(["open", "in_progress", "done", "rejected"]),
    admin_response: z.string().trim().max(5000).optional(),
    counts: z.literal("on").optional(),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Invalid input.");
  const d = parsed.data;
  const supabase = await createClient();
  const { data: rev, error } = await supabase
    .from("revision_requests")
    .update({
      status: d.status,
      admin_response: d.admin_response || null,
      counts_toward_limit: d.counts === "on",
      resolved_at: ["done", "rejected"].includes(d.status) ? new Date().toISOString() : null,
    })
    .eq("id", d.revision_id)
    .select("requested_by,title")
    .single();
  if (error) return fail(dbErrorMessage(error));
  if (rev?.requested_by) {
    await notifyUser({ userId: rev.requested_by, title: `Revision "${rev.title}": ${d.status.replace("_", " ")}`, body: d.admin_response || "Your revision request was updated.", link: `/dashboard/projects/${d.project_id}` });
  }
  revalidatePath(`/admin/projects/${d.project_id}`);
  return succeed("Revision updated.");
}

/** Admin uploaded a deliverable into the client's private folder. */
export async function registerDeliverable(input: { path: string; filename: string; size: number; mime?: string; project_id: string; client_id: string }): Promise<ActionState> {
  const admin = await assertAdmin();
  const d = z.object({
    path: z.string().min(3).max(500), filename: z.string().min(1).max(255), size: z.number().int().min(0).max(26_214_400),
    mime: z.string().max(150).optional(), project_id: z.uuid(), client_id: z.uuid(),
  }).safeParse(input);
  if (!d.success || !d.data.path.startsWith(`${d.data.client_id}/${d.data.project_id}/`)) return fail("Invalid file.");
  const supabase = await createClient();
  const { error } = await supabase.from("files").insert({
    owner_id: d.data.client_id, uploaded_by: admin.id, project_id: d.data.project_id, path: d.data.path,
    filename: d.data.filename, size_bytes: d.data.size, mime_type: d.data.mime ?? null, kind: "deliverable",
  });
  if (error) return fail(dbErrorMessage(error));
  await notifyUser({ userId: d.data.client_id, title: "New file delivered", body: d.data.filename, link: `/dashboard/projects/${d.data.project_id}` });
  revalidatePath(`/admin/projects/${d.data.project_id}`);
  return succeed("Deliverable shared with client.");
}

// ---------------------------------------------------------------- expenses
export async function addExpense(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await assertAdmin();
  const parsed = expenseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const amount = parseRinggit(parsed.data.amount);
  if (!amount) return fail("Enter a valid amount.", { amount: "Enter a valid RM amount" });
  const { amount: _a, ...rest } = parsed.data;
  void _a;
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({ ...rest, amount_cents: amount, created_by: admin.id });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/admin/finance");
  revalidatePath("/admin");
  return succeed("Expense recorded.");
}

export async function deleteExpense(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("expense_id"));
  const supabase = await createClient();
  await supabase.from("expenses").delete().eq("id", id);
  await audit("expense.deleted", "expense", id);
  revalidatePath("/admin/finance");
  redirect("/admin/finance");
}

// ---------------------------------------------------------------- bookings
export async function updateBooking(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    booking_id: z.uuid(),
    status: z.enum(["confirmed", "cancelled", "completed", "no_show"]),
    meeting_url: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
    send_email: z.literal("on").optional(),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Invalid input.");
  const d = parsed.data;
  if (d.meeting_url && !/^https:\/\//i.test(d.meeting_url)) return fail("Meeting link must start with https://");
  const supabase = await createClient();
  const { data: b, error } = await supabase.from("bookings").update({ status: d.status, meeting_url: d.meeting_url }).eq("id", d.booking_id).select("*").single();
  if (error || !b) return fail(dbErrorMessage(error));
  if (d.send_email) {
    const when = formatDateTime(b.start_at);
    const paragraphs = d.status === "cancelled"
      ? [`Hi ${b.name}, unfortunately we need to cancel your consultation on ${when}. Please book another time that suits you.`]
      : [`Hi ${b.name}, here are the details for your consultation on ${when} (Malaysia time).`, d.meeting_url ? `Video call link: ${d.meeting_url}` : "We'll share the call link shortly."];
    const { html, text } = emailLayout({
      heading: d.status === "cancelled" ? "Consultation cancelled" : "Your consultation details",
      paragraphs,
      cta: d.status === "cancelled" ? { label: "Book another time", url: `${env.siteUrl}/book` } : d.meeting_url ? { label: "Join video call", url: d.meeting_url } : undefined,
    });
    await sendEmail({ to: b.email, subject: d.status === "cancelled" ? "Consultation cancelled" : `Consultation details: ${when}`, html, text });
  }
  revalidatePath("/admin/bookings");
  return succeed("Booking updated.");
}

// --------------------------------------------------- portfolio/testimonials
export async function savePortfolioItem(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    id: z.uuid().optional().or(z.literal("")).transform((v) => (v ? v : null)),
    slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes"),
    title: z.string().trim().min(2).max(200),
    client_name: z.string().trim().max(160).optional().transform((v) => (v ? v : null)),
    summary: z.string().trim().min(10).max(1000),
    description: z.string().trim().max(10000).optional().transform((v) => (v ? v : null)),
    image_url: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
    live_url: z.string().trim().max(500).optional().transform((v) => (v ? v : null)),
    tags: z.string().max(300).optional(),
    is_published: z.literal("on").optional(),
    sort_order: z.coerce.number().int().min(0).max(10000).default(100),
    client_permission: z.literal("on").optional(),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const { id, tags, is_published, client_permission, ...rest } = parsed.data;
  for (const u of [rest.image_url, rest.live_url]) if (u && !/^https:\/\//i.test(u)) return fail("URLs must start with https://");
  if (is_published && rest.client_name && !client_permission) {
    return fail("Confirm you have the client's permission before publishing a named project.", { client_permission: "Required to publish" });
  }
  const row = { ...rest, tags: (tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10), is_published: Boolean(is_published) };
  const supabase = await createClient();
  const res = id ? await supabase.from("portfolio_items").update(row).eq("id", id) : await supabase.from("portfolio_items").insert(row);
  if (res.error) return fail(res.error.code === "23505" ? "Slug already used." : dbErrorMessage(res.error));
  revalidateMarketing();
  revalidatePath("/admin/portfolio");
  return succeed("Saved.");
}

export async function deletePortfolioItem(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("portfolio_items").delete().eq("id", id);
  revalidateMarketing();
  redirect("/admin/portfolio");
}

export async function setTestimonialPublished(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const publish = formData.get("publish") === "true";
  const supabase = await createClient();
  await supabase.from("testimonials").update({ is_published: publish }).eq("id", id).eq("consent_to_publish", true);
  await audit(publish ? "testimonial.published" : "testimonial.unpublished", "testimonial", id);
  revalidateMarketing();
  redirect("/admin/testimonials");
}

export async function addTestimonial(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    author_name: z.string().trim().min(2).max(120),
    author_title: z.string().trim().max(120).optional().transform((v) => (v ? v : null)),
    company: z.string().trim().max(160).optional().transform((v) => (v ? v : null)),
    quote: z.string().trim().min(10).max(2000),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    consent: z.literal("on", { message: "Only add testimonials the client gave you permission to publish" }),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const { consent, ...rest } = parsed.data;
  void consent;
  const supabase = await createClient();
  const { error } = await supabase.from("testimonials").insert({ ...rest, consent_to_publish: true, is_published: false });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/admin/testimonials");
  return succeed("Testimonial added (unpublished). Publish it from the list.");
}

export async function deleteTestimonial(formData: FormData) {
  await assertAdmin();
  const id = z.uuid().parse(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("testimonials").delete().eq("id", id);
  revalidateMarketing();
  redirect("/admin/testimonials");
}

// ------------------------------------------------------------ notifications
export async function sendClientNotification(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const parsed = z.object({
    client_id: z.uuid({ message: "Choose a client" }),
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(3).max(3000),
    link: z.string().trim().max(300).optional().transform((v) => (v ? v : undefined)),
    email: z.literal("on").optional(),
  }).safeParse(formToObject(formData));
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const d = parsed.data;
  if (d.link && !d.link.startsWith("/")) return fail("Link must be a path on this site, e.g. /dashboard/projects");
  await notifyUser({ userId: d.client_id, title: d.title, body: d.body, link: d.link, email: d.email === "on" });
  await audit("notification.sent", "profile", d.client_id, { title: d.title, email: d.email === "on" });
  return succeed("Notification sent.");
}

// ----------------------------------------------------------------- settings
export async function saveSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  await assertAdmin();
  const o = formToObject(formData);
  const parsed = z.object({
    business_name: z.string().trim().min(2).max(160),
    legal_name: z.string().trim().max(200).optional(),
    registration_no: z.string().trim().max(60).optional(),
    email: z.string().trim().max(254).optional(),
    phone: z.string().trim().max(40).optional(),
    whatsapp: z.string().trim().max(40).optional(),
    address: z.string().trim().max(500).optional(),
    bank_name: z.string().trim().max(100).optional(),
    bank_account_name: z.string().trim().max(160).optional(),
    bank_account_no: z.string().trim().max(40).optional(),
    duitnow_id: z.string().trim().max(60).optional(),
    sst_registered: z.literal("on").optional(),
    sst_number: z.string().trim().max(60).optional(),
    sst_rate: z.coerce.number().min(0).max(100),
    invoice_due_days: z.coerce.number().int().min(0).max(90),
    quote_validity_days: z.coerce.number().int().min(1).max(180),
    invoice_footer: z.string().trim().max(2000).optional(),
    auto_payment_reminders: z.literal("on").optional(),
    booking_enabled: z.literal("on").optional(),
    slot_minutes: z.coerce.number().int().min(15).max(240),
    booking_start: z.string().regex(/^\d{2}:\d{2}$/),
    booking_end: z.string().regex(/^\d{2}:\d{2}$/),
    min_notice_hours: z.coerce.number().int().min(0).max(336),
    max_days_ahead: z.coerce.number().int().min(1).max(120),
    blackout_dates: z.string().max(2000).optional(),
  }).safeParse(o);
  if (!parsed.success) return fail("Please check the fields.", zodFieldErrors(parsed.error));
  const d = parsed.data;
  if (d.email && !emailSchema.safeParse(d.email).success) return fail("Invalid business email.", { email: "Invalid email" });
  if (d.booking_end <= d.booking_start) return fail("Booking end time must be after start time.");
  const days = [0, 1, 2, 3, 4, 5, 6].filter((n) => formData.get(`day_${n}`) === "on");
  const blackout = (d.blackout_dates ?? "").split(/[\s,]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x));
  const nn = (v?: string) => (v ? v : null);
  const supabase = await createClient();
  const { error } = await supabase.from("business_settings").update({
    business_name: d.business_name, legal_name: nn(d.legal_name), registration_no: nn(d.registration_no), email: nn(d.email),
    phone: nn(d.phone), whatsapp: nn(d.whatsapp), address: nn(d.address), bank_name: nn(d.bank_name),
    bank_account_name: nn(d.bank_account_name), bank_account_no: nn(d.bank_account_no), duitnow_id: nn(d.duitnow_id),
    sst_registered: d.sst_registered === "on", sst_number: nn(d.sst_number), sst_rate: d.sst_registered === "on" ? d.sst_rate : 0,
    invoice_due_days: d.invoice_due_days, quote_validity_days: d.quote_validity_days, invoice_footer: nn(d.invoice_footer),
    auto_payment_reminders: d.auto_payment_reminders === "on",
    booking_config: {
      enabled: d.booking_enabled === "on", slot_minutes: d.slot_minutes, days, start: d.booking_start, end: d.booking_end,
      min_notice_hours: d.min_notice_hours, max_days_ahead: d.max_days_ahead, blackout_dates: blackout,
    },
  }).eq("id", 1);
  if (error) return fail(dbErrorMessage(error));
  await audit("settings.updated", "business_settings", "1");
  revalidatePath("/", "layout");
  return succeed("Settings saved.");
}
