import Link from "next/link";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { SectionTitle } from "@/components/app/bits";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Card, PageHeader, StatCard, StatusBadge } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { computeMetrics } from "@/lib/metrics";
import { formatMYR } from "@/lib/money";
import { formatDate, formatDateTime, isoDaysAgo, todayMY } from "@/lib/dates";
import { integrationStatus } from "@/lib/env";

export default async function AdminHome() {
  const supabase = await createClient();
  const since = isoDaysAgo(400);
  const [pay, exp, subs, inv, leads, bookings, projects, quotes] = await Promise.all([
    supabase.from("payments").select("amount_cents,refunded_cents,paid_at").gte("paid_at", since),
    supabase.from("expenses").select("amount_cents,incurred_on").gte("incurred_on", since.slice(0, 10)),
    supabase.from("subscriptions").select("price_cents,status"),
    supabase.from("invoices").select("id,number,title,total_cents,amount_paid_cents,status,due_date,client_id").in("status", ["open"]),
    supabase.from("leads").select("id,name,status,source,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("bookings").select("id,name,topic,start_at").eq("status", "confirmed").gte("start_at", new Date().toISOString()).order("start_at").limit(5),
    supabase.from("projects").select("id,name,status,due_date,progress").in("status", ["planning", "in_progress", "review", "awaiting_payment"]).order("due_date", { nullsFirst: false }),
    supabase.from("quotes").select("id,status,total_cents"),
  ]);
  const m = computeMetrics({
    payments: pay.data ?? [],
    expenses: exp.data ?? [],
    subscriptions: subs.data ?? [],
    invoices: inv.data ?? [],
  });
  const allLeads = leads.data ?? [];
  const newLeads = allLeads.filter((l) => l.status === "new");
  const pipeline = ["new", "contacted", "qualified", "proposal_sent", "won", "lost"].map((s) => ({ s, n: allLeads.filter((l) => l.status === s).length }));
  const q = quotes.data ?? [];
  const sentOrDone = q.filter((x) => ["sent", "accepted", "declined", "expired"].includes(x.status));
  const winRate = sentOrDone.length ? Math.round((q.filter((x) => x.status === "accepted").length / sentOrDone.length) * 100) : null;
  const today = todayMY();
  const overdueInvoices = (inv.data ?? []).filter((i) => i.due_date && i.due_date < today);
  const st = integrationStatus();
  const setupMissing = !st.stripe || !st.stripeWebhook || !st.email || !st.supabaseServiceRole;

  return (
    <>
      <PageHeader title="Business overview" description="Revenue, pipeline and what needs your attention." actions={<><ButtonLink href="/admin/quotes/new">New quotation</ButtonLink><ButtonLink href="/admin/ai" variant="secondary">AI assistant</ButtonLink></>} />
      {setupMissing && (
        <Alert tone="warning" className="mb-6" title="Finish setup to take payments">
          Some integrations are not configured ({[!st.stripe && "Stripe", !st.stripeWebhook && "Stripe webhook", !st.email && "email", !st.supabaseServiceRole && "Supabase service key"].filter(Boolean).join(", ")}). See <Link className="underline" href="/admin/settings">Settings → Integrations</Link>.
        </Alert>
      )}
      {st.stripe && st.stripeMode === "test" && <Alert tone="info" className="mb-6">Stripe is in <strong>test mode</strong>: payments are simulated. Switch to live keys to accept real money.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue this month" value={formatMYR(m.revenueThisMonth)} hint={`YTD ${formatMYR(m.ytdRevenue)}`} />
        <StatCard label="Profit this month" value={formatMYR(m.profitThisMonth)} hint={`Expenses ${formatMYR(m.expensesThisMonth)}`} tone={m.profitThisMonth < 0 ? "bad" : m.profitThisMonth > 0 ? "good" : undefined} />
        <StatCard label="Monthly recurring (MRR)" value={formatMYR(m.mrr)} hint={`${(subs.data ?? []).filter((s) => s.status === "active").length} active plans`} />
        <StatCard label="Outstanding" value={formatMYR(m.outstanding)} hint={m.overdue > 0 ? `${formatMYR(m.overdue)} overdue` : `${m.openInvoiceCount} open invoices`} tone={m.overdue > 0 ? "bad" : undefined} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <SectionTitle action={<Link className="text-sm text-brand-300" href="/admin/finance">Details</Link>}>Last 6 months</SectionTitle>
          <RevenueChart series={m.series} />
        </Card>
        <Card>
          <SectionTitle action={<Link className="text-sm text-brand-300" href="/admin/leads">All leads</Link>}>Pipeline</SectionTitle>
          <ul className="space-y-2 text-sm">
            {pipeline.map((p) => (
              <li key={p.s} className="flex items-center justify-between"><StatusBadge status={p.s} /><span className="tabular-nums text-fg">{p.n}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-subtle">Quote win rate: {winRate === null ? "—" : `${winRate}%`} · YTD profit {formatMYR(m.ytdProfit)}</p>
        </Card>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card>
          <SectionTitle>New leads ({newLeads.length})</SectionTitle>
          <ul className="space-y-2 text-sm">
            {newLeads.slice(0, 6).map((l) => (
              <li key={l.id}><Link className="text-fg hover:text-brand-300" href={`/admin/leads/${l.id}`}>{l.name}</Link> <span className="text-xs text-subtle">· {l.source.replace("_", " ")} · {formatDate(l.created_at)}</span></li>
            ))}
            {newLeads.length === 0 && <li className="text-muted">No new leads.</li>}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Upcoming consultations</SectionTitle>
          <ul className="space-y-2 text-sm">
            {(bookings.data ?? []).map((b) => <li key={b.id}><span className="text-fg">{formatDateTime(b.start_at)}</span><br /><span className="text-xs text-muted">{b.name} — {b.topic}</span></li>)}
            {(bookings.data ?? []).length === 0 && <li className="text-muted">None scheduled.</li>}
          </ul>
        </Card>
        <Card>
          <SectionTitle>Overdue invoices</SectionTitle>
          <ul className="space-y-2 text-sm">
            {overdueInvoices.map((i) => <li key={i.id}><Link className="text-fg hover:text-brand-300" href={`/admin/invoices/${i.id}`}>{i.number}</Link> <span className="text-xs text-red-300">due {formatDate(i.due_date)} · {formatMYR(i.total_cents - i.amount_paid_cents)}</span></li>)}
            {overdueInvoices.length === 0 && <li className="text-muted">Nothing overdue.</li>}
          </ul>
        </Card>
      </div>
      <Card className="mt-8">
        <SectionTitle action={<Link className="text-sm text-brand-300" href="/admin/projects">All projects</Link>}>Active projects & deadlines</SectionTitle>
        <ul className="divide-y divide-white/[0.05] text-sm">
          {(projects.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2">
              <Link className="text-fg hover:text-brand-300" href={`/admin/projects/${p.id}`}>{p.name}</Link>
              <span className="flex items-center gap-3"><span className={p.due_date && p.due_date < today ? "text-xs text-red-300" : "text-xs text-subtle"}>{p.due_date ? `due ${formatDate(p.due_date)}` : "no deadline"}</span><StatusBadge status={p.status} /></span>
            </li>
          ))}
          {(projects.data ?? []).length === 0 && <li className="py-2 text-muted">No active projects.</li>}
        </ul>
      </Card>
    </>
  );
}
