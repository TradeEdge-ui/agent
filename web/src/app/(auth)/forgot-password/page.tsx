import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { ForgotPasswordForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold text-fg">Reset your password</h1>
      <p className="mt-1 text-sm text-muted">We&apos;ll email you a secure link.</p>
      <div className="mt-6"><ForgotPasswordForm /></div>
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="text-brand-300">Back to sign in</Link></p>
    </Card>
  );
}
