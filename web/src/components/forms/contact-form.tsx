"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Honeypot, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { submitContact } from "@/actions/public";

export function ContactForm() {
  return (
    <ActionForm action={submitContact} className="space-y-5" successContent={(s) => <Alert tone="success" title="Message sent">{s.message}</Alert>}>
      {(state) => (
        <>
          <Honeypot />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name *" htmlFor="c-name" error={state.fieldErrors?.name}><Input id="c-name" name="name" autoComplete="name" required /></Field>
            <Field label="Email *" htmlFor="c-email" error={state.fieldErrors?.email}><Input id="c-email" name="email" type="email" autoComplete="email" required /></Field>
            <Field label="Phone" htmlFor="c-phone" error={state.fieldErrors?.phone}><Input id="c-phone" name="phone" type="tel" autoComplete="tel" /></Field>
            <Field label="Company" htmlFor="c-company" error={state.fieldErrors?.company}><Input id="c-company" name="company" autoComplete="organization" /></Field>
          </div>
          <Field label="Message *" htmlFor="c-message" error={state.fieldErrors?.message}><Textarea id="c-message" name="message" rows={5} required /></Field>
          <div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <Checkbox name="consent" required />
              <span>I agree to the <Link href="/legal/privacy" className="text-brand-300 underline" target="_blank">Privacy Policy</Link>.</span>
            </label>
            {state.fieldErrors?.consent && <p className="mt-1.5 text-xs text-red-300">{state.fieldErrors.consent}</p>}
          </div>
          <SubmitButton pendingText="Sending…">Send message</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
