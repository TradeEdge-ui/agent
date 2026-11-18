import Link from "next/link";
import { SectionTitle } from "@/components/app/bits";
import { EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { formatMYR } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { amountDue } from "@/lib/invoice-math";
import type { Invoice, Payment } from "@/lib/types";

export default async function InvoicesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [i, p] = await Promise.all([
    supabase.from("invoices").select("*").eq("client_id", user.id).neq("status", "draft").order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("client_id", user.id).order("paid_at", { ascending: false }),
  ]);
  const invoices = (i.data ?? []) as Invoice[];
  const payments = (p.data ?? []) as Payment[];
  return (
    <>
      <PageHeader title="Invoices & payments" description="Your billing history, outstanding invoices and receipts." />
      <SectionTitle>Invoices</SectionTitle>
      {invoices.length === 0 ? <EmptyState title="No invoices yet" /> : (
        <Table>
          <thead><tr><Th>Number</Th><Th>Description</Th><Th>Issued</Th><Th>Total</Th><Th>Balance</Th><Th>Status</Th></tr></thead>
          <tbody>
            {invoices.map((x) => (
              <tr key={x.id}>
                <Td><Link className="text-brand-300 hover:text-brand-200" href={`/dashboard/invoices/${x.id}`}>{x.number}</Link></Td>
                <Td className="text-fg">{x.title}</Td>
                <Td>{formatDate(x.issued_at)}</Td>
                <Td className="tabular-nums">{formatMYR(x.total_cents)}</Td>
                <Td className="tabular-nums">{x.status === "open" ? formatMYR(amountDue(x)) : "—"}</Td>
                <Td><StatusBadge status={x.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-10"><SectionTitle>Payments & receipts</SectionTitle></div>
      {payments.length === 0 ? <EmptyState title="No payments yet" /> : (
        <Table>
          <thead><tr><Th>Receipt</Th><Th>Date</Th><Th>Method</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
          <tbody>
            {payments.map((x) => (
              <tr key={x.id}>
                <Td><Link className="text-brand-300 hover:text-brand-200" href={`/dashboard/receipts/${x.id}`}>{x.receipt_number}</Link></Td>
                <Td>{formatDate(x.paid_at)}</Td>
                <Td>{x.method.replace("stripe_", "").replaceAll("_", " ")}</Td>
                <Td className="tabular-nums">{formatMYR(x.amount_cents)}</Td>
                <Td><StatusBadge status={x.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
