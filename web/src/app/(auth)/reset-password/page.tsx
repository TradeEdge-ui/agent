import type { Metadata } from "next";
import { Card } from "@/components/ui/primitives";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { requireUser } from "@/lib/auth";

// Always per-request: these pages depend on the signed-in user.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  await requireUser("/reset-password");
  return (
    <Card className="p-8">
      <h1 className="text-2xl font-semibold text-fg">Choose a new password</h1>
      <div className="mt-6"><ResetPasswordForm /></div>
    </Card>
  );
}
