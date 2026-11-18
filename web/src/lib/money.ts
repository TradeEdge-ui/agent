/** All money is handled as integer sen (1 MYR = 100 sen) to avoid float errors. */

const fmt = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtWhole = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function clean(s: string) {
  // Intl renders "RM 1,499.00" with a narrow/normal space depending on runtime.
  return s.replace(/^MYR\s?/, "RM").replace(/RM\s+/, "RM");
}

export function formatMYR(cents: number | bigint | string | null | undefined): string {
  const n = Number(cents ?? 0);
  return clean(fmt.format(n / 100));
}

/** Compact price for marketing (drops .00 when whole). */
export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "";
  const n = Number(cents);
  return clean(n % 100 === 0 ? fmtWhole.format(n / 100) : fmt.format(n / 100));
}

/** Parses "1,499.50" / "RM1499.5" / "1499" into sen. Returns null if invalid. */
export function parseRinggit(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  const s = input.trim().replace(/^RM\s*/i, "").replaceAll(",", "");
  if (s === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (Number(cents) / 100).toFixed(2);
}

export type PricedService = {
  price_min_cents: number | null;
  price_max_cents: number | null;
  billing_type: "one_time" | "monthly";
  purchase_mode: "direct" | "quote";
};

/** Human price label: "RM799 – RM1,499", "From RM499", "RM99/month", "Request quotation". */
export function priceLabel(s: PricedService): string {
  if (s.price_min_cents == null) return "Request quotation";
  if (s.billing_type === "monthly") return `${formatPrice(s.price_min_cents)}/month`;
  if (s.price_max_cents != null && s.price_max_cents > s.price_min_cents) {
    return `${formatPrice(s.price_min_cents)} – ${formatPrice(s.price_max_cents)}`;
  }
  return `From ${formatPrice(s.price_min_cents)}`;
}
