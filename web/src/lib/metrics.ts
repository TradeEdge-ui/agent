/** Pure business-metrics calculations for the admin dashboard (unit-tested). */

export type MetricPayment = { amount_cents: number; refunded_cents: number; paid_at: string };
export type MetricExpense = { amount_cents: number; incurred_on: string };
export type MetricSubscription = { price_cents: number; status: string };
export type MetricInvoice = { total_cents: number; amount_paid_cents: number; status: string; due_date: string | null };

export type MonthPoint = { month: string; label: string; revenue: number; expenses: number; profit: number };

const TZ = "Asia/Kuala_Lumpur";

export function monthKeyMY(iso: string): string {
  // Date-only strings are already local dates.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso.slice(0, 7);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit" }).format(new Date(iso)).slice(0, 7);
}

export function lastMonths(n: number, now: Date = new Date()): string[] {
  const current = monthKeyMY(now.toISOString());
  const [y, m] = current.split("-").map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function computeMetrics(input: {
  payments: MetricPayment[];
  expenses: MetricExpense[];
  subscriptions: MetricSubscription[];
  invoices: MetricInvoice[];
  now?: Date;
  months?: number;
}) {
  const now = input.now ?? new Date();
  const months = lastMonths(input.months ?? 6, now);
  const rev = new Map<string, number>();
  const exp = new Map<string, number>();
  for (const p of input.payments) {
    const k = monthKeyMY(p.paid_at);
    rev.set(k, (rev.get(k) ?? 0) + Number(p.amount_cents) - Number(p.refunded_cents ?? 0));
  }
  for (const e of input.expenses) {
    const k = monthKeyMY(e.incurred_on);
    exp.set(k, (exp.get(k) ?? 0) + Number(e.amount_cents));
  }
  const series: MonthPoint[] = months.map((m) => {
    const revenue = rev.get(m) ?? 0;
    const expenses = exp.get(m) ?? 0;
    const [y, mm] = m.split("-").map(Number);
    const label = new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-MY", { month: "short", timeZone: "UTC" });
    return { month: m, label, revenue, expenses, profit: revenue - expenses };
  });
  const thisMonth = series[series.length - 1];
  const year = months[months.length - 1].slice(0, 4);
  let ytdRevenue = 0;
  let ytdExpenses = 0;
  for (const [k, v] of rev) if (k.startsWith(year)) ytdRevenue += v;
  for (const [k, v] of exp) if (k.startsWith(year)) ytdExpenses += v;

  const mrr = input.subscriptions
    .filter((s) => s.status === "active" || s.status === "trialing" || s.status === "past_due")
    .reduce((s, x) => s + Number(x.price_cents), 0);
  const todayMy = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  const open = input.invoices.filter((i) => i.status === "open");
  const outstanding = open.reduce((s, i) => s + Math.max(0, Number(i.total_cents) - Number(i.amount_paid_cents)), 0);
  const overdue = open
    .filter((i) => i.due_date && i.due_date < todayMy)
    .reduce((s, i) => s + Math.max(0, Number(i.total_cents) - Number(i.amount_paid_cents)), 0);

  return {
    series,
    revenueThisMonth: thisMonth.revenue,
    expensesThisMonth: thisMonth.expenses,
    profitThisMonth: thisMonth.profit,
    ytdRevenue,
    ytdExpenses,
    ytdProfit: ytdRevenue - ytdExpenses,
    mrr,
    outstanding,
    overdue,
    openInvoiceCount: open.length,
  };
}
