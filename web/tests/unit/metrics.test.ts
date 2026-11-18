import { describe, expect, it } from "vitest";
import { computeMetrics, lastMonths, monthKeyMY } from "@/lib/metrics";

describe("business metrics", () => {
  it("buckets payments by Malaysian month (UTC+8)", () => {
    expect(monthKeyMY("2030-01-31T17:00:00Z")).toBe("2030-02"); // 1am on 1 Feb in KL
    expect(monthKeyMY("2030-01-31")).toBe("2030-01");
  });

  it("lists trailing months", () => {
    expect(lastMonths(3, new Date("2030-02-15T00:00:00Z"))).toEqual(["2029-12", "2030-01", "2030-02"]);
  });

  it("computes revenue net of refunds, profit, MRR and overdue balances", () => {
    const m = computeMetrics({
      now: new Date("2030-02-15T04:00:00Z"),
      payments: [
        { amount_cents: 100000, refunded_cents: 0, paid_at: "2030-02-01T03:00:00Z" },
        { amount_cents: 50000, refunded_cents: 20000, paid_at: "2030-02-10T03:00:00Z" },
        { amount_cents: 70000, refunded_cents: 0, paid_at: "2030-01-05T03:00:00Z" },
      ],
      expenses: [{ amount_cents: 30000, incurred_on: "2030-02-03" }],
      subscriptions: [{ price_cents: 24900, status: "active" }, { price_cents: 9900, status: "canceled" }],
      invoices: [
        { total_cents: 50000, amount_paid_cents: 0, status: "open", due_date: "2030-02-01" },
        { total_cents: 40000, amount_paid_cents: 10000, status: "open", due_date: "2030-03-01" },
        { total_cents: 99999, amount_paid_cents: 99999, status: "paid", due_date: "2030-01-01" },
      ],
    });
    expect(m.revenueThisMonth).toBe(130000);
    expect(m.expensesThisMonth).toBe(30000);
    expect(m.profitThisMonth).toBe(100000);
    expect(m.ytdRevenue).toBe(200000);
    expect(m.mrr).toBe(24900);
    expect(m.outstanding).toBe(80000);
    expect(m.overdue).toBe(50000);
    expect(m.series).toHaveLength(6);
  });
});
