import { ExpenseForm } from "@/components/admin/forms";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { SectionTitle } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Card, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { deleteExpense } from "@/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { computeMetrics } from "@/lib/metrics";
import { formatMYR } from "@/lib/money";
import { formatDate, isoDaysAgo, todayMY } from "@/lib/dates";

export default async function FinancePage() {
  const supabase = await createClient();
  const since = isoDaysAgo(400);
  const [pay, exp, subs, inv, projects] = await Promise.all([
    supabase.from("payments").select("id,receipt_number,amount_cents,refunded_cents,paid_at,method,profiles(full_name,email)").gte("paid_at", since).order("paid_at", { ascending: false }),
    supabase.from("expenses").select("*").gte("incurred_on", since.slice(0, 10)).order("incurred_on", { ascending: false }),
    supabase.from("subscriptions").select("price_cents,status"),
    supabase.from("invoices").select("total_cents,amount_paid_cents,status,due_date").eq("status", "open"),
    supabase.from("projects").select("id,name").order("created_at", { ascending: false }).limit(100),
  ]);
  const m = computeMetrics({ payments: pay.data ?? [], expenses: exp.data ?? [], subscriptions: subs.data ?? [], invoices: inv.data ?? [], months: 12 });
  return (
    <>
      <PageHeader title="Revenue & expenses" description="Cash-basis view: revenue is counted when a payment is verified; refunds are deducted." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue YTD" value={formatMYR(m.ytdRevenue)} />
        <StatCard label="Expenses YTD" value={formatMYR(m.ytdExpenses)} />
        <StatCard label="Profit YTD" value={formatMYR(m.ytdProfit)} tone={m.ytdProfit < 0 ? "bad" : "good"} />
        <StatCard label="MRR" value={formatMYR(m.mrr)} hint={`≈ ${formatMYR(m.mrr * 12)} / year`} />
      </div>
      <Card className="mt-6"><SectionTitle>Last 12 months</SectionTitle><RevenueChart series={m.series} /></Card>
      <Card className="mt-6"><SectionTitle>Record an expense</SectionTitle><ExpenseForm today={todayMY()} projects={projects.data ?? []} /></Card>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <div>
          <SectionTitle>Expenses</SectionTitle>
          <Table>
            <thead><tr><Th>Date</Th><Th>Description</Th><Th>Category</Th><Th>Amount</Th><Th /></tr></thead>
            <tbody>
              {(exp.data ?? []).map((e) => (
                <tr key={e.id}>
                  <Td>{formatDate(e.incurred_on)}</Td>
                  <Td className="text-fg">{e.description}{e.vendor && <span className="block text-xs text-subtle">{e.vendor}</span>}</Td>
                  <Td>{e.category}</Td>
                  <Td className="tabular-nums">{formatMYR(e.amount_cents)}</Td>
                  <Td><form action={deleteExpense}><input type="hidden" name="expense_id" value={e.id} /><Button size="sm" variant="ghost" type="submit">Delete</Button></form></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <SectionTitle>Payments received</SectionTitle>
          <Table>
            <thead><tr><Th>Date</Th><Th>Receipt</Th><Th>Client</Th><Th>Amount</Th></tr></thead>
            <tbody>
              {(pay.data ?? []).map((p) => {
                const prof = (Array.isArray(p.profiles) ? p.profiles[0] : p.profiles) as { full_name: string | null; email: string } | null;
                return (
                  <tr key={p.id}>
                    <Td>{formatDate(p.paid_at)}</Td>
                    <Td>{p.receipt_number}<span className="block text-xs text-subtle">{p.method.replaceAll("_", " ")}</span></Td>
                    <Td>{prof?.full_name ?? prof?.email ?? "—"}</Td>
                    <Td className="tabular-nums">{formatMYR(p.amount_cents - p.refunded_cents)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      </div>
      <p className="mt-6 text-xs text-subtle">Stripe processing fees are deducted by Stripe before payout. Record them as “Payment fees” expenses from your Stripe balance report for accurate profit.</p>
    </>
  );
}
