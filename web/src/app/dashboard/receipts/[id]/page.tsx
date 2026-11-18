import { notFound } from "next/navigation";
import { BusinessHeader } from "@/components/app/documents";
import { PrintButton } from "@/components/app/print-button";
import { Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/settings";
import { formatMYR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import type { Payment } from "@/lib/types";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("*, invoices(number,title)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Payment & { invoices: { number: string; title: string } | null };
  const settings = await getBusinessSettings();
  return (
    <>
      <PageHeader title={`Receipt ${p.receipt_number}`} actions={<><StatusBadge status={p.status} /><PrintButton /></>} />
      <Card className="print-surface max-w-2xl space-y-6">
        <div className="flex flex-col justify-between gap-6 sm:flex-row">
          <BusinessHeader settings={settings} />
          <div className="text-sm text-muted sm:text-right">
            <p className="text-base font-semibold text-fg">OFFICIAL RECEIPT</p>
            <p>{p.receipt_number}</p>
            <p>Received from: <span className="text-fg">{user.profile.full_name ?? user.email}</span></p>
          </div>
        </div>
        <DefinitionList items={[
          ["Amount received", <strong key="a" className="text-lg">{formatMYR(p.amount_cents)}</strong>],
          ["Date", formatDateTime(p.paid_at)],
          ["For invoice", p.invoices ? `${p.invoices.number} — ${p.invoices.title}` : "—"],
          ["Payment method", p.method.replace("stripe_", "").replaceAll("_", " ")],
          ["Reference", p.reference ?? p.provider_payment_id ?? "—"],
          ...(p.refunded_cents > 0 ? [["Refunded", formatMYR(p.refunded_cents)] as [string, string]] : []),
        ]} />
        {p.receipt_url && <p className="no-print text-sm"><a className="text-brand-300" href={p.receipt_url} target="_blank" rel="noopener noreferrer">View the payment processor&apos;s receipt →</a></p>}
        <p className="text-xs text-subtle">Thank you for your payment. This receipt was generated after the payment was verified.</p>
      </Card>
    </>
  );
}
