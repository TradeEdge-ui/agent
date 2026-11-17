import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate, todayMY } from "@/lib/dates";
import { cn } from "@/lib/cn";

const FILTERS = ["all", "draft", "open", "paid", "void"];

export default async function AdminInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("invoices").select("*, profiles(full_name,email)").order("created_at", { ascending: false }).limit(300);
  if (sp.status && sp.status !== "all") q = q.eq("status", sp.status);
  const { data } = await q;
  const today = todayMY();
  return (
    <>
      <PageHeader title="Invoices" actions={<ButtonLink href="/admin/invoices/new">New invoice</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => <Link key={f} href={f === "all" ? "/admin/invoices" : `/admin/invoices?status=${f}`} className={cn("rounded-full border px-3 py-1 text-xs", (sp.status ?? "all") === f ? "border-brand-400 bg-brand-500/15 text-fg" : "border-white/10 text-muted")}>{f}</Link>)}
      </div>
      {!data?.length ? <EmptyState title="No invoices" /> : (
        <Table>
          <thead><tr><Th>Number</Th><Th>Client</Th><Th>Title</Th><Th>Total</Th><Th>Paid</Th><Th>Due</Th><Th>Status</Th></tr></thead>
          <tbody>
            {data.map((i) => (
              <tr key={i.id}>
                <Td><Link className="text-brand-300" href={`/admin/invoices/${i.id}`}>{i.number}</Link></Td>
                <Td>{i.profiles?.full_name ?? i.profiles?.email}</Td>
                <Td className="text-fg">{i.title}</Td>
                <Td className="tabular-nums">{formatMYR(i.total_cents)}</Td>
                <Td className="tabular-nums">{formatMYR(i.amount_paid_cents)}</Td>
                <Td className={i.status === "open" && i.due_date && i.due_date < today ? "text-red-300" : undefined}>{formatDate(i.due_date)}</Td>
                <Td><StatusBadge status={i.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
