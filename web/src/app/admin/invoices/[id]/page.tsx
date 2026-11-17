import Link from "next/link";
import { notFound } from "next/navigation";
import { ManualPaymentForm } from "@/components/admin/forms";
import { LineItemsTable } from "@/components/app/documents";
import { SearchParamAlerts, SectionTitle } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, DefinitionList, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { issueInvoice, sendInvoiceReminder, voidInvoice } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { formatMYR, centsToInput } from "@/lib/money";
import { formatDate, formatDateTime, todayMY } from "@/lib/dates";
import { amountDue } from "@/lib/invoice-math";
import type { Invoice, Payment } from "@/lib/types";

export default async function AdminInvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; issued?: string; reminded?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*, profiles(full_name,email)").eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as Invoice & { profiles: { full_name: string | null; email: string } | null };
  const { data: pays } = await supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at");
  const payments = (pays ?? []) as Payment[];
  const due = amountDue(inv);

  return (
    <>
      <SearchParamAlerts messages={[
        { when: Boolean(sp.error), tone: "danger", text: sp.error },
        { when: sp.issued === "1", tone: "success", text: "Invoice issued and client notified." },
        { when: sp.reminded === "1", tone: "success", text: "Reminder sent." },
      ]} />
      <PageHeader
        title={`Invoice ${inv.number}`}
        description={inv.title}
        actions={<>
          <StatusBadge status={inv.status} />
          {inv.status === "draft" && <form action={issueInvoice}><input type="hidden" name="invoice_id" value={inv.id} /><Button size="sm" type="submit">Issue & notify client</Button></form>}
          {inv.status === "open" && <form action={sendInvoiceReminder}><input type="hidden" name="invoice_id" value={inv.id} /><Button size="sm" variant="secondary" type="submit">Send reminder</Button></form>}
          {["draft", "open"].includes(inv.status) && inv.amount_paid_cents === 0 && <form action={voidInvoice}><input type="hidden" name="invoice_id" value={inv.id} /><Button size="sm" variant="ghost" type="submit">Void</Button></form>}
        </>}
      />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card><LineItemsTable items={inv.line_items} subtotal={inv.subtotal_cents} discount={inv.discount_cents} taxRate={inv.tax_rate} tax={inv.tax_cents} total={inv.total_cents} extraRows={[["Paid", formatMYR(inv.amount_paid_cents)], ["Refunded", formatMYR(inv.amount_refunded_cents)], ["Balance", formatMYR(due)]]} /></Card>
          <Card>
            <SectionTitle>Payments</SectionTitle>
            <ul className="space-y-2 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2">
                  <span className="text-fg">{p.receipt_number} · {formatDateTime(p.paid_at)} · {p.method.replaceAll("_", " ")}</span>
                  <span className="flex items-center gap-2 tabular-nums">{formatMYR(p.amount_cents)} <StatusBadge status={p.status} /></span>
                  {p.reference && <span className="w-full text-xs text-subtle">Ref: {p.reference}</span>}
                </li>
              ))}
              {payments.length === 0 && <li className="text-muted">No payments recorded.</li>}
            </ul>
            <p className="mt-4 text-xs text-subtle">Refunds are issued from your Stripe dashboard and recorded here automatically. You approve every refund.</p>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <DefinitionList items={[
              ["Client", inv.profiles ? <Link key="c" className="text-brand-300" href={`/admin/clients/${inv.client_id}`}>{inv.profiles.full_name ?? inv.profiles.email}</Link> : "—"],
              ["Kind", inv.kind],
              ["Issued", formatDate(inv.issued_at)],
              ["Due", formatDate(inv.due_date)],
              ["Paid", formatDateTime(inv.paid_at)],
              ["Project", inv.project_id ? <Link key="p" className="text-brand-300" href={`/admin/projects/${inv.project_id}`}>View</Link> : "—"],
              ["Stripe session", inv.stripe_checkout_session_id ?? "—"],
              ["Stripe payment", inv.stripe_payment_intent_id ?? "—"],
            ]} />
          </Card>
          {inv.status === "open" && due > 0 && <Card><SectionTitle>Record bank transfer</SectionTitle><ManualPaymentForm invoiceId={inv.id} defaultAmount={centsToInput(due)} today={todayMY()} /></Card>}
        </div>
      </div>
    </>
  );
}
