import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Alert } from "@/components/ui/primitives";
import { LoginForm } from "@/components/forms/auth-forms";
import { getCurrentUser, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Client login", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; confirmed?: string }> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(safeNext(sp.next, user.profile.role === "admin" ? "/admin" : "/dashboard"));
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold text-fg">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Sign in to your client portal.</p>
      {sp.error && <Alert tone="danger" className="mt-5">That link is invalid or has expired. Please try again.</Alert>}
      {sp.confirmed && <Alert tone="success" className="mt-5">Email confirmed. You can sign in now.</Alert>}
      <div className="mt-6"><LoginForm next={sp.next} /></div>
      <p className="mt-6 text-center text-sm text-muted">
        New client? <Link href={`/register${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="text-brand-300 hover:text-brand-200">Create an account</Link>
      </p>
    </Card>
  );
}
