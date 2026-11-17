"use client";

import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { createProjectRequest, postProjectMessage, requestRevision, setSubscriptionCancellation, submitTestimonial, updateProfile } from "@/actions/client";
import { BUDGET_OPTIONS, TIMELINE_OPTIONS } from "@/lib/validation";
import type { Profile } from "@/lib/types";

export function ProjectRequestForm({ services, defaultService }: { services: { slug: string; name: string }[]; defaultService?: string }) {
  return (
    <ActionForm action={createProjectRequest} className="space-y-5" successContent={(s) => <Alert tone="success" title="Request sent">{s.message}</Alert>}>
      {(s) => (
        <>
          <Field label="Title *" htmlFor="title" error={s.fieldErrors?.title}><Input id="title" name="title" placeholder="E.g. Website for my new café" required /></Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Service" htmlFor="service_slug"><Select id="service_slug" name="service_slug" defaultValue={defaultService ?? ""}><option value="">Not sure</option>{services.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</Select></Field>
            <Field label="Budget" htmlFor="budget"><Select id="budget" name="budget" defaultValue=""><option value="">Select…</option>{BUDGET_OPTIONS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
            <Field label="Timeline" htmlFor="timeline"><Select id="timeline" name="timeline" defaultValue=""><option value="">Select…</option>{TIMELINE_OPTIONS.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          </div>
          <Field label="Current website" htmlFor="website_url" error={s.fieldErrors?.website_url}><Input id="website_url" name="website_url" type="url" placeholder="https://" /></Field>
          <Field label="What do you need? *" htmlFor="goals" error={s.fieldErrors?.goals} hint="Goals, pages/features, integrations, references. You can upload files in the Files section.">
            <Textarea id="goals" name="goals" rows={7} required />
          </Field>
          <SubmitButton pendingText="Sending…">Send request</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RevisionForm({ projectId, remaining }: { projectId: string; remaining: number }) {
  return (
    <ActionForm action={requestRevision} className="space-y-4" resetOnSuccess>
      {(s) => (
        <>
          <input type="hidden" name="project_id" value={projectId} />
          {remaining <= 0 && <Alert tone="warning">You have used the revision rounds included in your package. Further revisions may be quoted separately — we&apos;ll confirm before doing any chargeable work.</Alert>}
          <Field label="Title" htmlFor="rev-title" error={s.fieldErrors?.title}><Input id="rev-title" name="title" placeholder="E.g. Homepage text changes" required /></Field>
          <Field label="Details" htmlFor="rev-details" error={s.fieldErrors?.details} hint="List all changes for this round in one request."><Textarea id="rev-details" name="details" rows={4} required /></Field>
          <SubmitButton variant="secondary" pendingText="Sending…">Submit revision request</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ProjectMessageForm({ projectId }: { projectId: string }) {
  return (
    <ActionForm action={postProjectMessage} className="space-y-3" resetOnSuccess hideMessage>
      {(s) => (
        <>
          <input type="hidden" name="project_id" value={projectId} />
          <Textarea name="body" rows={3} placeholder="Write a message to the team…" aria-label="Message" required />
          {s.fieldErrors?.body && <p className="text-xs text-red-300">{s.fieldErrors.body}</p>}
          <SubmitButton size="sm" pendingText="Sending…">Send message</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ProfileForm({ profile }: { profile: Profile }) {
  return (
    <ActionForm action={updateProfile} className="space-y-5">
      {(s) => (
        <>
          <Field label="Full name" htmlFor="full_name" error={s.fieldErrors?.full_name}><Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ""} required /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={s.fieldErrors?.phone}><Input id="phone" name="phone" defaultValue={profile.phone ?? ""} /></Field>
            <Field label="Company" htmlFor="company_name" error={s.fieldErrors?.company_name}><Input id="company_name" name="company_name" defaultValue={profile.company_name ?? ""} /></Field>
          </div>
          <label className="flex items-start gap-3 text-sm text-muted">
            <Checkbox name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} />
            <span>Send me occasional tips and offers by email (you can unsubscribe anytime).</span>
          </label>
          <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function TestimonialForm({ projects, defaultName, defaultCompany }: { projects: { id: string; name: string }[]; defaultName: string; defaultCompany: string }) {
  return (
    <ActionForm action={submitTestimonial} className="space-y-5" successContent={(s) => <Alert tone="success">{s.message}</Alert>}>
      {(s) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name to display" htmlFor="author_name" error={s.fieldErrors?.author_name}><Input id="author_name" name="author_name" defaultValue={defaultName} required /></Field>
            <Field label="Company" htmlFor="t-company"><Input id="t-company" name="company" defaultValue={defaultCompany} /></Field>
            <Field label="Your role" htmlFor="author_title"><Input id="author_title" name="author_title" placeholder="E.g. Owner" /></Field>
            <Field label="Rating" htmlFor="rating"><Select id="rating" name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} / 5</option>)}</Select></Field>
          </div>
          {projects.length > 0 && (
            <Field label="Project" htmlFor="project_id"><Select id="project_id" name="project_id" defaultValue=""><option value="">General</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          )}
          <Field label="Your experience" htmlFor="quote" error={s.fieldErrors?.quote}><Textarea id="quote" name="quote" rows={4} required /></Field>
          <div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <Checkbox name="consent" required />
              <span>I give ARyzz AI Solutions permission to publish this testimonial with my name and company on its website and marketing.</span>
            </label>
            {s.fieldErrors?.consent && <p className="mt-1.5 text-xs text-red-300">{s.fieldErrors.consent}</p>}
          </div>
          <SubmitButton variant="secondary" pendingText="Sending…">Submit testimonial</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function SubscriptionToggle({ subscriptionId, cancelAtPeriodEnd }: { subscriptionId: string; cancelAtPeriodEnd: boolean }) {
  return (
    <ActionForm action={setSubscriptionCancellation}>
      <input type="hidden" name="subscription_id" value={subscriptionId} />
      <input type="hidden" name="cancel" value={cancelAtPeriodEnd ? "false" : "true"} />
      {cancelAtPeriodEnd ? (
        <SubmitButton size="sm" variant="secondary" pendingText="Updating…">Keep my plan</SubmitButton>
      ) : (
        <SubmitButton size="sm" variant="danger" pendingText="Cancelling…" confirm="Cancel this plan at the end of the current billing period?">Cancel plan</SubmitButton>
      )}
    </ActionForm>
  );
}
