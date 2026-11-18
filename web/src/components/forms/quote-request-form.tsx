"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Honeypot, Input, Select, Textarea } from "@/components/ui/form";
import { Alert, Card } from "@/components/ui/primitives";
import { buttonClass } from "@/components/ui/button";
import { submitQuoteRequest } from "@/actions/public";
import { BUDGET_OPTIONS, TIMELINE_OPTIONS } from "@/lib/validation";

export function QuoteRequestForm({ services, defaultService }: { services: { slug: string; name: string }[]; defaultService?: string }) {
  return (
    <ActionForm
      action={submitQuoteRequest}
      className="space-y-5"
      successContent={(s) => (
        <Card className="text-center">
          <h2 className="text-xl font-semibold text-fg">Thank you — request received!</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted">
            We&apos;ll review your requirements and reply by email. Create a client account with <strong className="text-fg">{String(s.data?.email ?? "your email")}</strong> to
            receive your quotation, accept it and pay online.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Link className={buttonClass("primary")} href={`/register?email=${encodeURIComponent(String(s.data?.email ?? ""))}`}>Create client account</Link>
            <Link className={buttonClass("secondary")} href="/book">Book a free call</Link>
          </div>
        </Card>
      )}
    >
      {(state) => (
        <>
          <Honeypot />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name *" htmlFor="name" error={state.fieldErrors?.name}>
              <Input id="name" name="name" autoComplete="name" required />
            </Field>
            <Field label="Email *" htmlFor="email" error={state.fieldErrors?.email}>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Phone / WhatsApp" htmlFor="phone" error={state.fieldErrors?.phone}>
              <Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+60 12-345 6789" />
            </Field>
            <Field label="Company / business name" htmlFor="company" error={state.fieldErrors?.company}>
              <Input id="company" name="company" autoComplete="organization" />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Service" htmlFor="service_slug" error={state.fieldErrors?.service_slug}>
              <Select id="service_slug" name="service_slug" defaultValue={defaultService ?? ""}>
                <option value="">Not sure yet</option>
                {services.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Budget" htmlFor="budget" error={state.fieldErrors?.budget}>
              <Select id="budget" name="budget" defaultValue="">
                <option value="">Select…</option>
                {BUDGET_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </Field>
            <Field label="Timeline" htmlFor="timeline" error={state.fieldErrors?.timeline}>
              <Select id="timeline" name="timeline" defaultValue="">
                <option value="">Select…</option>
                {TIMELINE_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Current website (if any)" htmlFor="website_url" error={state.fieldErrors?.website_url}>
            <Input id="website_url" name="website_url" type="url" placeholder="https://" />
          </Field>
          <Field label="What do you want to achieve? *" htmlFor="goals" error={state.fieldErrors?.goals} hint="Your business, your customers, and what success looks like.">
            <Textarea id="goals" name="goals" rows={5} required />
          </Field>
          <Field label="Pages or features you need" htmlFor="pages_or_features" error={state.fieldErrors?.pages_or_features} hint="E.g. 6 pages, booking form, online payments, BM/EN, chatbot on WhatsApp…">
            <Textarea id="pages_or_features" name="pages_or_features" rows={3} />
          </Field>
          <Field label="Websites you like (references)" htmlFor="references" error={state.fieldErrors?.references}>
            <Textarea id="references" name="references" rows={2} />
          </Field>
          <div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <Checkbox name="consent" required />
              <span>
                I agree to ARyzz AI Solutions processing my details to respond to this request, as described in the{" "}
                <Link href="/legal/privacy" className="text-brand-300 underline" target="_blank">Privacy Policy</Link>.
              </span>
            </label>
            {state.fieldErrors?.consent && <p className="mt-1.5 text-xs text-red-300">{state.fieldErrors.consent}</p>}
          </div>
          <SubmitButton size="lg" pendingText="Sending…" className="w-full sm:w-auto">Request my quotation</SubmitButton>
          <Alert tone="neutral">No payment needed. You&apos;ll receive a written quotation to review before anything is charged.</Alert>
        </>
      )}
    </ActionForm>
  );
}
