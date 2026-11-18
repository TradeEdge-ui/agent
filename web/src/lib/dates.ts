const TZ = "Asia/Kuala_Lumpur";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00+08:00` : value) : value;
  return new Intl.DateTimeFormat("en-MY", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);
}

export function formatTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-MY", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
}

/** Today's date in Malaysia as YYYY-MM-DD. */
export function todayMY(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function relativeDays(isoDate: string | null | undefined, now: Date = new Date()): number | null {
  if (!isoDate) return null;
  const a = new Date(`${todayMY(now)}T00:00:00Z`).getTime();
  const b = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** ISO timestamp for `days` ago (server-side query helper). */
export function isoDaysAgo(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function isFuture(iso: string, now: Date = new Date()): boolean {
  return new Date(iso).getTime() > now.getTime();
}
