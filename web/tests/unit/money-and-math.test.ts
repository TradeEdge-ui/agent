import { describe, expect, it } from "vitest";
import { formatMYR, formatPrice, parseRinggit, priceLabel } from "@/lib/money";
import { amountDue, computeTotals, scheduleIsValid, splitByPercent } from "@/lib/invoice-math";

describe("money", () => {
  it("formats sen as Malaysian Ringgit", () => {
    expect(formatMYR(149900)).toBe("RM1,499.00");
    expect(formatMYR(39950)).toBe("RM399.50");
    expect(formatPrice(79900)).toBe("RM799");
    expect(formatPrice(9950)).toBe("RM99.50");
  });

  it("parses user-entered ringgit amounts into integer sen without float errors", () => {
    expect(parseRinggit("1,499.50")).toBe(149950);
    expect(parseRinggit("RM 0.10")).toBe(10);
    expect(parseRinggit("19.99")).toBe(1999);
    expect(parseRinggit("100")).toBe(10000);
    expect(parseRinggit("1.234")).toBeNull();
    expect(parseRinggit("-5")).toBeNull();
    expect(parseRinggit("abc")).toBeNull();
    expect(parseRinggit("")).toBeNull();
  });

  it("builds honest price labels for each package type", () => {
    expect(priceLabel({ price_min_cents: 79900, price_max_cents: 149900, billing_type: "one_time", purchase_mode: "direct" })).toBe("RM799 – RM1,499");
    expect(priceLabel({ price_min_cents: 49900, price_max_cents: null, billing_type: "one_time", purchase_mode: "quote" })).toBe("From RM499");
    expect(priceLabel({ price_min_cents: 9900, price_max_cents: null, billing_type: "monthly", purchase_mode: "direct" })).toBe("RM99/month");
    expect(priceLabel({ price_min_cents: null, price_max_cents: null, billing_type: "one_time", purchase_mode: "quote" })).toBe("Request quotation");
  });
});

describe("invoice math", () => {
  it("computes totals with discount before tax", () => {
    const t = computeTotals(
      [
        { description: "Website", quantity: 1, unit_price_cents: 250000 },
        { description: "Extra page", quantity: 3, unit_price_cents: 15000 },
      ],
      45000,
      8,
    );
    expect(t).toEqual({ subtotal_cents: 295000, discount_cents: 45000, tax_cents: 20000, total_cents: 270000 });
  });

  it("never lets a discount exceed the subtotal", () => {
    expect(computeTotals([{ description: "x", quantity: 1, unit_price_cents: 1000 }], 5000, 0).total_cents).toBe(0);
  });

  it("splits instalments so they always sum to the total (same rule as the database)", () => {
    const parts = splitByPercent(100001, [{ label: "a", percent: 30 }, { label: "b", percent: 30 }, { label: "c", percent: 40 }]);
    expect(parts).toEqual([30000, 30000, 40001]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100001);
  });

  it("validates payment schedules", () => {
    expect(scheduleIsValid([{ label: "a", percent: 50 }, { label: "b", percent: 50 }])).toBe(true);
    expect(scheduleIsValid([{ label: "a", percent: 50 }])).toBe(false);
    expect(scheduleIsValid([{ label: "a", percent: 100 }, { label: "b", percent: 0 }])).toBe(false);
    expect(scheduleIsValid([])).toBe(false);
  });

  it("computes the outstanding balance", () => {
    expect(amountDue({ total_cents: 100000, amount_paid_cents: 40000 })).toBe(60000);
    expect(amountDue({ total_cents: 100000, amount_paid_cents: 120000 })).toBe(0);
  });
});
