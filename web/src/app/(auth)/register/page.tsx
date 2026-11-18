import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/primitives";
import { RegisterForm } from "@/components/forms/auth-forms";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold text-fg">Create your client account</h1>
      <p className="mt-1 text-sm text-muted">Review quotations, pay invoices and follow your project in one place.</p>
      <div className="mt-6"><RegisterForm defaultEmail={email?.slice(0, 254)} /></div>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="text-brand-300 hover:text-brand-200">Sign in</Link>
      </p>
    </Card>
  );
}
