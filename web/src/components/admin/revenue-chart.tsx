import { formatPrice } from "@/lib/money";
import type { MonthPoint } from "@/lib/metrics";

/** Accessible SVG bar chart: revenue vs expenses per month. */
export function RevenueChart({ series }: { series: MonthPoint[] }) {
  const max = Math.max(1, ...series.flatMap((s) => [s.revenue, s.expenses]));
  const h = 160;
  return (
    <figure>
      <div className="flex h-[200px] items-end gap-3 sm:gap-6" role="img" aria-label="Revenue and expenses by month">
        {series.map((s) => (
          <div key={s.month} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-[160px] w-full items-end justify-center gap-1">
              <div className="w-1/2 max-w-6 rounded-t bg-gradient-to-t from-brand-600 to-brand-400" style={{ height: `${(s.revenue / max) * h}px` }} title={`Revenue ${formatPrice(s.revenue)}`} />
              <div className="w-1/2 max-w-6 rounded-t bg-white/20" style={{ height: `${(s.expenses / max) * h}px` }} title={`Expenses ${formatPrice(s.expenses)}`} />
            </div>
            <span className="text-xs text-subtle">{s.label}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> Revenue (net of refunds)</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-white/30" /> Expenses</span>
      </figcaption>
      <table className="sr-only">
        <thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead>
        <tbody>{series.map((s) => <tr key={s.month}><td>{s.month}</td><td>{formatPrice(s.revenue)}</td><td>{formatPrice(s.expenses)}</td><td>{formatPrice(s.profit)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
