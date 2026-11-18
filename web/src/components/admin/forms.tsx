"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import {
  addExpense, addMilestone, addTestimonial, createManualLead, postProjectUpdate, recordManualPayment, registerDeliverable,
  respondRevision, savePortfolioItem, saveSettings, sendClientNotification, updateBooking, updateLead, updateProject,
} from "@/actions/admin";
import { createClient } from "@/lib/supabase/browser";
import { EXPENSE_CATEGORIES } from "@/lib/validation";
import type { Booking, BusinessSettings, PortfolioItem, Project, RevisionRequest } from "@/lib/types";

const LEAD_STATUSES = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"] as const;
const PROJECT_STATUSES = ["awaiting_payment", "planning", "in_progress", "review", "completed", "on_hold", "cancelled"] as const;

export function LeadUpdateForm({ leadId, status, notes }: { leadId: string; status: string; notes: string }) {
  return (
    <ActionForm action={updateLead} className="space-y-4">
      <input type="hidden" name="lead_id" value={leadId} />
      <Field label="Pipeline stage" htmlFor="status">
        <Select id="status" name="status" defaultValue={status}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select>
      </Field>
      <Field label="Private notes" htmlFor="internal_notes" hint="Only visible to admins.">
        <Textarea id="internal_notes" name="internal_notes" rows={4} defaultValue={notes} />
      </Field>
      <SubmitButton size="sm" pendingText="Saving…">Save</SubmitButton>
    </ActionForm>
  );
}

export function ManualLeadForm() {
  return (
    <ActionForm action={createManualLead} className="space-y-4">
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="ml-name" error={s.fieldErrors?.name}><Input id="ml-name" name="name" required /></Field>
            <Field label="Email" htmlFor="ml-email" error={s.fieldErrors?.email}><Input id="ml-email" name="email" type="email" required /></Field>
            <Field label="Phone" htmlFor="ml-phone"><Input id="ml-phone" name="phone" /></Field>
            <Field label="Company" htmlFor="ml-company"><Input id="ml-company" name="company" /></Field>
          </div>
          <Field label="Notes / requirements" htmlFor="ml-message" error={s.fieldErrors?.message}><Textarea id="ml-message" name="message" rows={3} required /></Field>
          <SubmitButton size="sm" pendingText="Saving…">Add lead</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ManualPaymentForm({ invoiceId, defaultAmount, today }: { invoiceId: string; defaultAmount: string; today: string }) {
  return (
    <ActionForm action={recordManualPayment} className="space-y-4" resetOnSuccess>
      {(s) => (
        <>
          <input type="hidden" name="invoice_id" value={invoiceId} />
          <Alert tone="warning">Only record a payment after you have verified the funds in your bank account.</Alert>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Amount (RM)" htmlFor="mp-amount" error={s.fieldErrors?.amount}><Input id="mp-amount" name="amount" inputMode="decimal" defaultValue={defaultAmount} required /></Field>
            <Field label="Paid on" htmlFor="mp-date" error={s.fieldErrors?.paid_on}><Input id="mp-date" name="paid_on" type="date" defaultValue={today} required /></Field>
            <Field label="Method" htmlFor="mp-method"><Select id="mp-method" name="method" defaultValue="bank_transfer"><option value="bank_transfer">Bank transfer</option><option value="duitnow">DuitNow</option><option value="cash">Cash</option><option value="cheque">Cheque</option><option value="other">Other</option></Select></Field>
            <Field label="Reference" htmlFor="mp-ref" error={s.fieldErrors?.reference}><Input id="mp-ref" name="reference" placeholder="Bank ref no." required /></Field>
          </div>
          <SubmitButton size="sm" variant="secondary" pendingText="Recording…" confirm="Record this payment? A receipt will be issued to the client.">Record verified payment</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ProjectEditForm({ project }: { project: Project }) {
  return (
    <ActionForm action={updateProject} className="space-y-4">
      {(s) => (
        <>
          <input type="hidden" name="project_id" value={project.id} />
          <Field label="Name" htmlFor="p-name" error={s.fieldErrors?.name}><Input id="p-name" name="name" defaultValue={project.name} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="p-status"><Select id="p-status" name="status" defaultValue={project.status}>{PROJECT_STATUSES.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</Select></Field>
            <Field label="Progress %" htmlFor="p-progress"><Input id="p-progress" name="progress" type="number" min={0} max={100} defaultValue={project.progress} /></Field>
            <Field label="Start date" htmlFor="p-start"><Input id="p-start" name="start_date" type="date" defaultValue={project.start_date ?? ""} /></Field>
            <Field label="Target date" htmlFor="p-due" hint="Shown to the client — only set a date you commit to."><Input id="p-due" name="due_date" type="date" defaultValue={project.due_date ?? ""} /></Field>
            <Field label="Revision rounds" htmlFor="p-rev"><Input id="p-rev" name="revisions_included" type="number" min={0} defaultValue={project.revisions_included} /></Field>
          </div>
          <Field label="Staging / preview URL" htmlFor="p-staging"><Input id="p-staging" name="staging_url" defaultValue={project.staging_url ?? ""} placeholder="https://" /></Field>
          <Field label="Live URL" htmlFor="p-live"><Input id="p-live" name="live_url" defaultValue={project.live_url ?? ""} placeholder="https://" /></Field>
          <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="notify" /> Notify the client about this change</label>
          <SubmitButton size="sm" pendingText="Saving…">Save project</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function MilestoneForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={addMilestone} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Input name="title" placeholder="Milestone title" aria-label="Milestone title" required />
        <Input name="due_date" type="date" aria-label="Target date" />
      </div>
      <Input name="description" placeholder="Description (optional)" aria-label="Description" />
      <SubmitButton size="sm" variant="secondary" pendingText="Adding…">Add milestone</SubmitButton>
    </ActionForm>
  );
}

export function AdminUpdateForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={postProjectUpdate} className="space-y-3" resetOnSuccess>
      <input type="hidden" name="project_id" value={projectId} />
      <Textarea name="body" rows={4} placeholder="Write an update for the client…" aria-label="Update" required />
      <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="is_internal" /> Internal note (client won&apos;t see it)</label>
      <SubmitButton size="sm" pendingText="Posting…">Post update</SubmitButton>
    </ActionForm>
  );
}

export function RevisionResponseForm({ revision, projectId }: { revision: RevisionRequest; projectId: string }) {
  return (
    <ActionForm action={respondRevision} className="mt-3 space-y-3">
      <input type="hidden" name="revision_id" value={revision.id} />
      <input type="hidden" name="project_id" value={projectId} />
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <Select name="status" defaultValue={revision.status} aria-label="Status">{["open", "in_progress", "done", "rejected"].map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</Select>
        <Input name="admin_response" defaultValue={revision.admin_response ?? ""} placeholder="Response to client" aria-label="Response" />
      </div>
      <label className="flex items-center gap-2 text-xs text-muted"><Checkbox name="counts" defaultChecked={revision.counts_toward_limit} /> Counts toward included revision rounds</label>
      <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Update</SubmitButton>
    </ActionForm>
  );
}

export function DeliverableUpload({ clientId, projectId }: { clientId: string; projectId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const safe = file.name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120);
    const path = `${clientId}/${projectId}/${crypto.randomUUID()}-${safe}`;
    const { error } = await createClient().storage.from("project-files").upload(path, file, { contentType: file.type || undefined });
    if (error) setMsg(error.message);
    else {
      const res = await registerDeliverable({ path, filename: file.name.slice(0, 255), size: file.size, mime: file.type || undefined, project_id: projectId, client_id: clientId });
      setMsg(res.message ?? null);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }
  return (
    <div>
      <input ref={input} type="file" className="hidden" onChange={onChange} />
      <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Deliver a file to client"}</Button>
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}

export function ExpenseForm({ today, projects }: { today: string; projects: { id: string; name: string }[] }) {
  return (
    <ActionForm action={addExpense} className="space-y-4" resetOnSuccess>
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date" htmlFor="e-date" error={s.fieldErrors?.incurred_on}><Input id="e-date" name="incurred_on" type="date" defaultValue={today} required /></Field>
            <Field label="Amount (RM)" htmlFor="e-amount" error={s.fieldErrors?.amount}><Input id="e-amount" name="amount" inputMode="decimal" placeholder="0.00" required /></Field>
            <Field label="Category" htmlFor="e-cat"><Select id="e-cat" name="category" defaultValue={EXPENSE_CATEGORIES[0]}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Description" htmlFor="e-desc" error={s.fieldErrors?.description}><Input id="e-desc" name="description" required /></Field>
            <Field label="Vendor" htmlFor="e-vendor"><Input id="e-vendor" name="vendor" /></Field>
            <Field label="Project (optional)" htmlFor="e-proj"><Select id="e-proj" name="project_id" defaultValue=""><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          </div>
          <SubmitButton size="sm" pendingText="Saving…">Add expense</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function BookingUpdateForm({ booking }: { booking: Booking }) {
  return (
    <ActionForm action={updateBooking} className="mt-3 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_auto] sm:items-end">
      <input type="hidden" name="booking_id" value={booking.id} />
      <div><Label htmlFor={`bs-${booking.id}`}>Status</Label><Select id={`bs-${booking.id}`} name="status" defaultValue={booking.status}>{["confirmed", "completed", "no_show", "cancelled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select></div>
      <div><Label htmlFor={`bm-${booking.id}`}>Meeting link</Label><Input id={`bm-${booking.id}`} name="meeting_url" defaultValue={booking.meeting_url ?? ""} placeholder="https://meet.google.com/…" /></div>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-xs text-muted"><Checkbox name="send_email" /> Email client</label>
        <SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save</SubmitButton>
      </div>
    </ActionForm>
  );
}

export function PortfolioForm({ item }: { item?: PortfolioItem }) {
  return (
    <ActionForm action={savePortfolioItem} className="space-y-4" resetOnSuccess={!item}>
      {(s) => (
        <>
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" htmlFor={`pf-title-${item?.id ?? "new"}`} error={s.fieldErrors?.title}><Input id={`pf-title-${item?.id ?? "new"}`} name="title" defaultValue={item?.title} required /></Field>
            <Field label="Slug" htmlFor={`pf-slug-${item?.id ?? "new"}`} error={s.fieldErrors?.slug}><Input id={`pf-slug-${item?.id ?? "new"}`} name="slug" defaultValue={item?.slug} placeholder="cafe-website" required /></Field>
            <Field label="Client name (optional)" htmlFor={`pf-client-${item?.id ?? "new"}`}><Input id={`pf-client-${item?.id ?? "new"}`} name="client_name" defaultValue={item?.client_name ?? ""} /></Field>
            <Field label="Tags (comma separated)" htmlFor={`pf-tags-${item?.id ?? "new"}`}><Input id={`pf-tags-${item?.id ?? "new"}`} name="tags" defaultValue={item?.tags.join(", ")} /></Field>
            <Field label="Image URL (https)" htmlFor={`pf-img-${item?.id ?? "new"}`}><Input id={`pf-img-${item?.id ?? "new"}`} name="image_url" defaultValue={item?.image_url ?? ""} /></Field>
            <Field label="Live URL (https)" htmlFor={`pf-live-${item?.id ?? "new"}`}><Input id={`pf-live-${item?.id ?? "new"}`} name="live_url" defaultValue={item?.live_url ?? ""} /></Field>
          </div>
          <Field label="Summary" htmlFor={`pf-sum-${item?.id ?? "new"}`} error={s.fieldErrors?.summary}><Textarea id={`pf-sum-${item?.id ?? "new"}`} name="summary" rows={2} defaultValue={item?.summary} required /></Field>
          <input type="hidden" name="sort_order" value={item?.sort_order ?? 100} />
          <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="is_published" defaultChecked={item?.is_published} /> Published</label>
          <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="client_permission" defaultChecked={Boolean(item?.is_published)} /> The client agreed to be featured (required for named projects)</label>
          {s.fieldErrors?.client_permission && <p className="text-xs text-red-300">{s.fieldErrors.client_permission}</p>}
          <SubmitButton size="sm" pendingText="Saving…">{item ? "Save" : "Add project"}</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function TestimonialAdminForm() {
  return (
    <ActionForm action={addTestimonial} className="space-y-4" resetOnSuccess>
      {(s) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client name" htmlFor="t-name" error={s.fieldErrors?.author_name}><Input id="t-name" name="author_name" required /></Field>
            <Field label="Company" htmlFor="t-co"><Input id="t-co" name="company" /></Field>
            <Field label="Role" htmlFor="t-role"><Input id="t-role" name="author_title" /></Field>
            <Field label="Rating" htmlFor="t-rating"><Select id="t-rating" name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((r) => <option key={r}>{r}</option>)}</Select></Field>
          </div>
          <Field label="Testimonial (client's own words)" htmlFor="t-quote" error={s.fieldErrors?.quote}><Textarea id="t-quote" name="quote" rows={3} required /></Field>
          <label className="flex items-start gap-2 text-sm text-muted"><Checkbox name="consent" /> I have the client&apos;s written permission to publish this exact testimonial.</label>
          {s.fieldErrors?.consent && <p className="text-xs text-red-300">{s.fieldErrors.consent}</p>}
          <SubmitButton size="sm" pendingText="Saving…">Add testimonial</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function SendNotificationForm({ clients, defaultClient }: { clients: { id: string; label: string }[]; defaultClient?: string }) {
  return (
    <ActionForm action={sendClientNotification} className="space-y-4" resetOnSuccess>
      {(s) => (
        <>
          <Field label="Client" htmlFor="n-client" error={s.fieldErrors?.client_id}>
            <Select id="n-client" name="client_id" defaultValue={defaultClient ?? ""} required><option value="">Choose…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select>
          </Field>
          <Field label="Title" htmlFor="n-title" error={s.fieldErrors?.title}><Input id="n-title" name="title" required /></Field>
          <Field label="Message" htmlFor="n-body" error={s.fieldErrors?.body}><Textarea id="n-body" name="body" rows={4} required /></Field>
          <Field label="Link (optional)" htmlFor="n-link" hint="E.g. /dashboard/invoices"><Input id="n-link" name="link" /></Field>
          <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="email" defaultChecked /> Also send by email</label>
          <SubmitButton size="sm" pendingText="Sending…">Send notification</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function SettingsForm({ settings }: { settings: BusinessSettings }) {
  const b = settings.booking_config;
  return (
    <ActionForm action={saveSettings} className="space-y-8">
      {(s) => (
        <>
          <section className="space-y-4">
            <h2 className="font-semibold text-fg">Business details</h2>
            <p className="text-sm text-muted">Shown in the website footer, contact page, quotations and invoices.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Trading name" htmlFor="business_name" error={s.fieldErrors?.business_name}><Input id="business_name" name="business_name" defaultValue={settings.business_name} required /></Field>
              <Field label="Legal / registered name" htmlFor="legal_name"><Input id="legal_name" name="legal_name" defaultValue={settings.legal_name ?? ""} /></Field>
              <Field label="SSM registration no." htmlFor="registration_no"><Input id="registration_no" name="registration_no" defaultValue={settings.registration_no ?? ""} /></Field>
              <Field label="Public email" htmlFor="email" error={s.fieldErrors?.email}><Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} /></Field>
              <Field label="Phone" htmlFor="phone"><Input id="phone" name="phone" defaultValue={settings.phone ?? ""} /></Field>
              <Field label="WhatsApp number" htmlFor="whatsapp" hint="With country code, e.g. 60123456789"><Input id="whatsapp" name="whatsapp" defaultValue={settings.whatsapp ?? ""} /></Field>
            </div>
            <Field label="Address (shown on invoices)" htmlFor="address"><Textarea id="address" name="address" rows={2} defaultValue={settings.address ?? ""} /></Field>
          </section>
          <section className="space-y-4">
            <h2 className="font-semibold text-fg">Bank transfer details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bank" htmlFor="bank_name"><Input id="bank_name" name="bank_name" defaultValue={settings.bank_name ?? ""} /></Field>
              <Field label="Account name" htmlFor="bank_account_name"><Input id="bank_account_name" name="bank_account_name" defaultValue={settings.bank_account_name ?? ""} /></Field>
              <Field label="Account number" htmlFor="bank_account_no"><Input id="bank_account_no" name="bank_account_no" defaultValue={settings.bank_account_no ?? ""} /></Field>
              <Field label="DuitNow ID" htmlFor="duitnow_id"><Input id="duitnow_id" name="duitnow_id" defaultValue={settings.duitnow_id ?? ""} /></Field>
            </div>
          </section>
          <section className="space-y-4">
            <h2 className="font-semibold text-fg">Tax & documents</h2>
            <Alert tone="info">Only enable SST once you are registered with RMCD. Existing invoices are not changed.</Alert>
            <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="sst_registered" defaultChecked={settings.sst_registered} /> Registered for Service Tax (SST)</label>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="SST number" htmlFor="sst_number"><Input id="sst_number" name="sst_number" defaultValue={settings.sst_number ?? ""} /></Field>
              <Field label="SST rate %" htmlFor="sst_rate"><Input id="sst_rate" name="sst_rate" type="number" step="0.01" min={0} max={100} defaultValue={settings.sst_rate} /></Field>
              <Field label="Invoice due (days)" htmlFor="invoice_due_days"><Input id="invoice_due_days" name="invoice_due_days" type="number" min={0} max={90} defaultValue={settings.invoice_due_days} /></Field>
              <Field label="Quote validity (days)" htmlFor="quote_validity_days"><Input id="quote_validity_days" name="quote_validity_days" type="number" min={1} max={180} defaultValue={settings.quote_validity_days} /></Field>
            </div>
            <Field label="Invoice footer" htmlFor="invoice_footer"><Textarea id="invoice_footer" name="invoice_footer" rows={2} defaultValue={settings.invoice_footer ?? ""} /></Field>
            <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="auto_payment_reminders" defaultChecked={settings.auto_payment_reminders} /> Send automatic reminders for overdue invoices (max once every 3 days)</label>
          </section>
          <section className="space-y-4">
            <h2 className="font-semibold text-fg">Consultation availability (Malaysia time)</h2>
            <label className="flex items-center gap-2 text-sm text-muted"><Checkbox name="booking_enabled" defaultChecked={b.enabled} /> Accept online bookings</label>
            <div className="flex flex-wrap gap-3">
              {DAYS.map((d, i) => (
                <label key={d} className="flex items-center gap-1.5 text-sm text-muted"><Checkbox name={`day_${i}`} defaultChecked={b.days.includes(i)} /> {d}</label>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Field label="Start" htmlFor="booking_start"><Input id="booking_start" name="booking_start" type="time" defaultValue={b.start} /></Field>
              <Field label="End" htmlFor="booking_end"><Input id="booking_end" name="booking_end" type="time" defaultValue={b.end} /></Field>
              <Field label="Slot (min)" htmlFor="slot_minutes"><Input id="slot_minutes" name="slot_minutes" type="number" min={15} max={240} defaultValue={b.slot_minutes} /></Field>
              <Field label="Min notice (h)" htmlFor="min_notice_hours"><Input id="min_notice_hours" name="min_notice_hours" type="number" min={0} defaultValue={b.min_notice_hours} /></Field>
              <Field label="Days ahead" htmlFor="max_days_ahead"><Input id="max_days_ahead" name="max_days_ahead" type="number" min={1} defaultValue={b.max_days_ahead} /></Field>
            </div>
            <Field label="Blocked dates" htmlFor="blackout_dates" hint="YYYY-MM-DD, separated by commas (public holidays, leave)."><Input id="blackout_dates" name="blackout_dates" defaultValue={b.blackout_dates.join(", ")} /></Field>
          </section>
          <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
