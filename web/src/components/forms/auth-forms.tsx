"use client";

import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="space-y-5">
      {(s) => (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email" htmlFor="email" error={s.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
          <Field label="Password" htmlFor="password" error={s.fieldErrors?.password}><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
          <div className="flex items-center justify-between">
            <Link href="/forgot-password" className="text-sm text-brand-300 hover:text-brand-200">Forgot password?</Link>
          </div>
          <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Sign in</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function RegisterForm({ defaultEmail }: { defaultEmail?: string }) {
  return (
    <ActionForm
      action={signUp}
      className="space-y-5"
      successContent={(s) => (
        <Alert tone="success" title="Almost there!">
          {s.message} We sent the link to <strong>{String(s.data?.email ?? "")}</strong>.
        </Alert>
      )}
    >
      {(s) => (
        <>
          <Field label="Full name" htmlFor="full_name" error={s.fieldErrors?.full_name}><Input id="full_name" name="full_name" autoComplete="name" required /></Field>
          <Field label="Email" htmlFor="email" error={s.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required /></Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Phone" htmlFor="phone" error={s.fieldErrors?.phone}><Input id="phone" name="phone" type="tel" autoComplete="tel" /></Field>
            <Field label="Company" htmlFor="company_name" error={s.fieldErrors?.company_name}><Input id="company_name" name="company_name" autoComplete="organization" /></Field>
          </div>
          <Field label="Password" htmlFor="password" error={s.fieldErrors?.password} hint="At least 10 characters with a letter and a number.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
          </Field>
          <div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <Checkbox name="terms" required />
              <span>
                I agree to the <Link className="text-brand-300 underline" href="/legal/terms" target="_blank">Terms of Service</Link>,{" "}
                <Link className="text-brand-300 underline" href="/legal/privacy" target="_blank">Privacy Policy</Link> and{" "}
                <Link className="text-brand-300 underline" href="/legal/refund" target="_blank">Refund Policy</Link>.
              </span>
            </label>
            {s.fieldErrors?.terms && <p className="mt-1.5 text-xs text-red-300">{s.fieldErrors.terms}</p>}
          </div>
          <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ForgotPasswordForm() {
  return (
    <ActionForm action={requestPasswordReset} className="space-y-5" successContent={(s) => <Alert tone="success">{s.message}</Alert>}>
      {(s) => (
        <>
          <Field label="Email" htmlFor="email" error={s.fieldErrors?.email}><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
          <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}

export function ResetPasswordForm() {
  return (
    <ActionForm action={updatePassword} className="space-y-5">
      {(s) => (
        <>
          <Field label="New password" htmlFor="password" error={s.fieldErrors?.password} hint="At least 10 characters with a letter and a number.">
            <Input id="password" name="password" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={s.fieldErrors?.confirm}>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
          </Field>
          <SubmitButton className="w-full" pendingText="Saving…">Update password</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
