import { describe, expect, it } from "vitest";
import { generateSlots, isSlotAvailable } from "@/lib/booking";
import { buildIcs } from "@/lib/ics";

// Monday 2030-01-07 08:00 in Malaysia (= 00:00 UTC).
const NOW = new Date("2030-01-07T00:00:00Z");
const config = { enabled: true, slot_minutes: 30, days: [1, 2, 3, 4, 5], start: "10:00", end: "12:00", min_notice_hours: 24, max_days_ahead: 7, blackout_dates: ["2030-01-09"] };

describe("consultation slots", () => {
  it("generates weekday slots in Malaysia time respecting minimum notice", () => {
    const slots = generateSlots(config, [], NOW);
    // Monday is within 24h notice, so first slot is Tuesday 10:00 MYT = 02:00 UTC.
    expect(slots[0]).toMatchObject({ date: "2030-01-08", label: "10:00", start: "2030-01-08T02:00:00.000Z", end: "2030-01-08T02:30:00.000Z" });
    expect(slots.filter((s) => s.date === "2030-01-08")).toHaveLength(4);
  });

  it("skips weekends and blackout dates", () => {
    const dates = new Set(generateSlots(config, [], NOW).map((s) => s.date));
    expect(dates.has("2030-01-09")).toBe(false); // blackout
    expect(dates.has("2030-01-12")).toBe(false); // Saturday
    expect(dates.has("2030-01-13")).toBe(false); // Sunday
    expect(dates.has("2030-01-10")).toBe(true);
  });

  it("removes taken slots and rejects bookings for unavailable times", () => {
    const taken = ["2030-01-08T02:00:00.000Z"];
    expect(generateSlots(config, taken, NOW).some((s) => s.start === taken[0])).toBe(false);
    expect(isSlotAvailable(config, taken, "2030-01-08T02:00:00Z", NOW)).toBeNull();
    expect(isSlotAvailable(config, taken, "2030-01-08T02:30:00Z", NOW)?.label).toBe("10:30");
    expect(isSlotAvailable(config, [], "2030-01-08T02:10:00Z", NOW)).toBeNull(); // not on the grid
    expect(isSlotAvailable(config, [], "2030-01-07T03:00:00Z", NOW)).toBeNull(); // too soon
  });

  it("returns nothing when bookings are disabled", () => {
    expect(generateSlots({ ...config, enabled: false }, [], NOW)).toEqual([]);
  });

  it("builds a valid calendar invite", () => {
    const ics = buildIcs({ uid: "abc@aryzz", start: new Date("2030-01-08T02:00:00Z"), end: new Date("2030-01-08T02:30:00Z"), summary: "Call, with ARyzz", description: "Line1\nLine2" });
    expect(ics).toContain("DTSTART:20300108T020000Z");
    expect(ics).toContain("SUMMARY:Call\\, with ARyzz");
    expect(ics).toContain("DESCRIPTION:Line1\\nLine2");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
