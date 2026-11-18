import type { BookingConfig } from "@/lib/types";

/** Malaysia observes no daylight saving: always UTC+8. */
export const MY_OFFSET_MINUTES = 8 * 60;

export const DEFAULT_BOOKING_CONFIG: BookingConfig = {
  enabled: true,
  slot_minutes: 30,
  days: [1, 2, 3, 4, 5],
  start: "10:00",
  end: "17:00",
  min_notice_hours: 24,
  max_days_ahead: 21,
  blackout_dates: [],
};

export type Slot = { start: string; end: string; date: string; label: string };

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Generates open consultation slots (UTC ISO strings) from the availability
 * config, excluding taken slots, blackout dates and anything inside the
 * minimum-notice window. Pure function — easy to test.
 */
export function generateSlots(
  config: Partial<BookingConfig> | null | undefined,
  takenStartIsos: string[],
  now: Date = new Date(),
): Slot[] {
  const c = { ...DEFAULT_BOOKING_CONFIG, ...(config ?? {}) };
  if (!c.enabled) return [];
  const slotMin = Math.max(15, Math.min(240, Number(c.slot_minutes) || 30));
  const startMin = parseHM(c.start);
  const endMin = parseHM(c.end);
  const taken = new Set(takenStartIsos.map((s) => new Date(s).toISOString()));
  const blackout = new Set(c.blackout_dates ?? []);
  const earliest = now.getTime() + c.min_notice_hours * 3_600_000;

  // "Today" in Malaysia.
  const nowMy = new Date(now.getTime() + MY_OFFSET_MINUTES * 60_000);
  const baseY = nowMy.getUTCFullYear();
  const baseM = nowMy.getUTCMonth();
  const baseD = nowMy.getUTCDate();

  const slots: Slot[] = [];
  for (let dayOffset = 0; dayOffset <= c.max_days_ahead; dayOffset++) {
    const dayUtcMidnight = Date.UTC(baseY, baseM, baseD + dayOffset);
    const day = new Date(dayUtcMidnight);
    const weekday = day.getUTCDay();
    const dateStr = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}`;
    if (!c.days.includes(weekday) || blackout.has(dateStr)) continue;
    for (let m = startMin; m + slotMin <= endMin; m += slotMin) {
      // Local MY time -> UTC.
      const startUtc = dayUtcMidnight + (m - MY_OFFSET_MINUTES) * 60_000;
      if (startUtc < earliest) continue;
      const iso = new Date(startUtc).toISOString();
      if (taken.has(iso)) continue;
      slots.push({
        start: iso,
        end: new Date(startUtc + slotMin * 60_000).toISOString(),
        date: dateStr,
        label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
      });
    }
  }
  return slots;
}

export function isSlotAvailable(
  config: Partial<BookingConfig> | null | undefined,
  takenStartIsos: string[],
  slotIso: string,
  now: Date = new Date(),
): Slot | null {
  const target = new Date(slotIso).toISOString();
  return generateSlots(config, takenStartIsos, now).find((s) => s.start === target) ?? null;
}
