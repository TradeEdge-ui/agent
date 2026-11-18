import Link from "next/link";
import { EmptyState, PageHeader, StatCard, StatusBadge, Table, Td, Th } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/money";
import { formatDate } from "@/lib/dates";

export default async function AdminSubscriptionsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("subscriptions").select("*, profiles(full_name,email)").order("created_at", { ascending: false });
  const subs = data ?? [];
  const active = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrr = active.reduce((a, s) => a + s.price_cents, 0);
  return (
    <>
      <PageHeader title="Subscriptions" description="Monthly care plans billed through Stripe. Clients cancel from their dashboard; changes sync automatically." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="MRR" value={formatMYR(mrr)} />
        <StatCard label="Active plans" value={active.length} />
        <StatCard label="Payment issues" value={subs.filter((s) => s.status === "past_due" || s.status === "unpaid").length} tone={subs.some((s) => s.status === "past_due") ? "bad" : undefined} />
      </div>
      {!subs.length ? <EmptyState title="No subscriptions yet" /> : (
        <Table>
          <thead><tr><Th>Client</Th><Th>Plan</Th><Th>Price</Th><Th>Renews / ends</Th><Th>Status</Th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <Td><Link className="text-fg hover:text-brand-300" href={`/admin/clients/${s.client_id}`}>{s.profiles?.full_name ?? s.profiles?.email}</Link></Td>
                <Td>{s.plan_name}</Td>
                <Td className="tabular-nums">{formatMYR(s.price_cents)}/mo</Td>
                <Td>{formatDate(s.current_period_end)}{s.cancel_at_period_end && <span className="ml-2 text-xs text-amber-300">cancels</span>}</Td>
                <Td><StatusBadge status={s.status} /></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
