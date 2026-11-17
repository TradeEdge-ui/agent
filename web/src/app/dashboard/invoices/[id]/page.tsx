import Link from "next/link";
import { notFound } from "next/navigation";
import { BankTransferDetails, BusinessHeader, LineItemsTable } from "@/components/app/documents";
import { SearchParamAlerts } from "@/components/app/bits";
import { PaymentStatusPoller } from "@/components/app/payment-status-poller";
import { PrintButton } from "@/components/app/print-button";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { IconLock } from "@/components/icons";
import { payInvoice } from "@/actions/client";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBusinessSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe/client";
import { formatMYR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { amountDue } from "@/lib/invoice-math";
import type { Invoice, Payment } from "@/lib/types";

export default async function InvoiceDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkout?: string; error?: string; accepted?: string; ordered?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const inv = data as Invoice;
  const { data: pays } = await supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at");
  const payments = (pays ?? []) as Payment[];
  const settings = await getBusinessSettings();
  const due = amountDue(inv);
  const stripeOn = isStripeConfigured();

  return (
    <>
      <SearchParamAlerts
        messages={[
          { when: sp.accepted === "1", tone: "success", text: "Quotation accepted — thank you! Your project has been created. Pay the first invoice below to get started." },
          { when: sp.ordered === "1", tone: "success", text: "Order placed. Pay the deposit below to start your project." },
          { when: sp.checkout === "success" && inv.status === "paid", tone: "success", text: "Payment confirmed. Thank you! A receipt has been added below." },
          { when: sp.checkout === "success" && inv.status !== "paid", tone: "info", text: "Thanks! We're waiting for the payment provider to confirm your payment. This usually takes a few seconds — we never mark an invoice paid until it's verified." },
          { when: sp.checkout === "cancelled", tone: "warning", text: "Payment cancelled. No money was taken." },
          { when: Boolean(sp.error), tone: "danger", text: sp.error },
        ]}
      />
      {sp.checkout === "success" && <div className="mb-4"><PaymentStatusPoller paid={inv.status === "paid"} /></div>}
      <PageHeader title={`Invoice ${inv.number}`} description={inv.title} actions={<><StatusBadge status={inv.status} /><PrintButton /></>} />
      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <Card className="print-surface space-y-8">
          <div className="flex flex-col justify-between gap-6 sm:flex-row">
            <BusinessHeader settings={settings} />
            <div className="text-sm text-muted sm:text-right">
              <p className="text-base font-semibold text-fg">INVOICE</p>
              <p>{inv.number}</p>
              <p>Issued: {formatDate(inv.issued_at)}</p>
              {inv.due_date && <p>Due: {formatDate(inv.due_date)}</p>}
              <p className="mt-3">Bill to: <span className="text-fg">{user.profile.full_name ?? user.email}</span></p>
              {user.profile.company_name && <p>{user.profile.company_name}</p>}
              <p>{user.email}</p>
            </div>
          </div>
          <LineItemsTable
            items={inv.line_items}
            subtotal={inv.subtotal_cents}
            discount={inv.discount_cents}
            taxRate={inv.tax_rate}
            tax={inv.tax_cents}
            total={inv.total_cents}
            extraRows={[["Paid", formatMYR(inv.amount_paid_cents)], ["Balance due", <strong key="b">{formatMYR(due)}</strong>]]}
          />
          {inv.notes && <p className="whitespace-pre-line text-sm text-muted">{inv.notes}</p>}
          {settings.invoice_footer && <p className="whitespace-pre-line border-t border-white/10 pt-4 text-xs text-subtle">{settings.invoice_footer}</p>}
          {!settings.sst_registered && <p className="text-xs text-subtle">This is a computer-generated invoice. No SST is charged.</p>}
        </Card>
        <div className="no-print space-y-4">
          {inv.status === "open" && due > 0 && (
            <Card>
              <p className="text-sm text-muted">Amount due</p>
              <p className="text-3xl font-semibold text-fg">{formatMYR(due)}</p>
              {stripeOn ? (
                <form action={payInvoice} className="mt-4">
                  <input type="hidden" name="invoice_id" value={inv.id} />
                  <Button type="submit" className="w-full" size="lg">Pay now — card or FPX</Button>
                </form>
              ) : (
                <p className="mt-3 text-sm text-amber-200">Online payment is being set up. Please pay by bank transfer below.</p>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-xs text-subtle"><IconLock className="h-3.5 w-3.5" /> Secure checkout by Stripe. We never see your card details.</p>
            </Card>
          )}
          {inv.status === "open" && due > 0 && <BankTransferDetails settings={settings} reference={inv.number} />}
          {inv.hosted_invoice_url && (
            <Card><a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-300">View Stripe invoice{inv.invoice_pdf_url ? " / PDF" : ""} →</a></Card>
          )}
          {payments.length > 0 && (
            <Card>
              <p className="font-medium text-fg">Payments</p>
              <ul className="mt-3 space-y-2 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <Link className="text-brand-300" href={`/dashboard/receipts/${p.id}`}>{p.receipt_number}</Link>
                    <span className="tabular-nums text-fg">{formatMYR(p.amount_cents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {inv.project_id && <Card><Link className="text-sm text-brand-300" href={`/dashboard/projects/${inv.project_id}`}>View project →</Link></Card>}
        </div>
      </div>
    </>
  );
}
