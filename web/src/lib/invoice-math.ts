import type { LineItem, ScheduleItem } from "@/lib/types";

export type Totals = { subtotal_cents: number; discount_cents: number; tax_cents: number; total_cents: number };

/** Computes document totals in integer sen. Tax applies after discount. */
export function computeTotals(items: LineItem[], discountCents: number, taxRatePercent: number): Totals {
  const subtotal = items.reduce((sum, i) => sum + Math.round(i.quantity * i.unit_price_cents), 0);
  const discount = Math.min(Math.max(0, Math.round(discountCents)), subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round((taxable * Math.max(0, taxRatePercent)) / 100);
  return { subtotal_cents: subtotal, discount_cents: discount, tax_cents: tax, total_cents: taxable + tax };
}

/** Mirrors public.split_by_percent: last instalment absorbs rounding. */
export function splitByPercent(totalCents: number, schedule: ScheduleItem[]): number[] {
  let allocated = 0;
  return schedule.map((s, i) => {
    const amt = i === schedule.length - 1 ? totalCents - allocated : Math.round((totalCents * s.percent) / 100);
    allocated += amt;
    return amt;
  });
}

export function scheduleIsValid(schedule: ScheduleItem[]): boolean {
  if (schedule.length === 0) return false;
  if (schedule.some((s) => !(s.percent > 0))) return false;
  return Math.abs(schedule.reduce((s, i) => s + i.percent, 0) - 100) < 0.001;
}

export function amountDue(inv: { total_cents: number; amount_paid_cents: number }): number {
  return Math.max(0, Number(inv.total_cents) - Number(inv.amount_paid_cents));
}
