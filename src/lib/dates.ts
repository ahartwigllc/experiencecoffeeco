/**
 * Timezone-aware helpers. All reporting ("this month", "today", time-clock weeks)
 * uses the business timezone, not the server's (Workers run in UTC).
 */

export function tz(): string {
  return process.env.APP_TIMEZONE || "America/New_York";
}

export function formatDate(
  d: Date | string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: tz(), ...opts }).format(new Date(d));
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return formatDate(d, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatTime(d: Date | string | null | undefined): string {
  return formatDate(d, { hour: "numeric", minute: "2-digit" });
}

/** Minutes the zone is ahead of UTC at a given instant (negative for US zones). */
function tzOffsetMinutes(at: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * The instant of local midnight for a calendar date in the zone. Month/day may
 * overflow (e.g. month 13, day 0) and are normalized like Date.UTC does.
 */
export function zonedMidnight(year: number, month1: number, day: number, zone = tz()): Date {
  const guess = new Date(Date.UTC(year, month1 - 1, day));
  const off1 = tzOffsetMinutes(guess, zone);
  const candidate = new Date(guess.getTime() - off1 * 60000);
  const off2 = tzOffsetMinutes(candidate, zone);
  return off1 === off2 ? candidate : new Date(guess.getTime() - off2 * 60000);
}

export function zonedParts(d: Date, zone = tz()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: get("weekday") };
}

export type RangeKey = "today" | "week" | "month" | "last_month" | "ytd" | "last_12" | "all";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  last_month: "Last month",
  ytd: "Year to date",
  last_12: "Last 12 months",
  all: "All time",
};

export function isRangeKey(v: unknown): v is RangeKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(RANGE_LABELS, v);
}

/** [start, end) for a named range. Weeks start on Monday. */
export function rangeBounds(key: RangeKey, now = new Date(), zone = tz()): { start: Date; end: Date } {
  const { year, month, day, weekday } = zonedParts(now, zone);
  const tomorrow = zonedMidnight(year, month, day + 1, zone);
  switch (key) {
    case "today":
      return { start: zonedMidnight(year, month, day, zone), end: tomorrow };
    case "week": {
      const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
      return { start: zonedMidnight(year, month, day - Math.max(idx, 0), zone), end: tomorrow };
    }
    case "month":
      return { start: zonedMidnight(year, month, 1, zone), end: zonedMidnight(year, month + 1, 1, zone) };
    case "last_month":
      return { start: zonedMidnight(year, month - 1, 1, zone), end: zonedMidnight(year, month, 1, zone) };
    case "ytd":
      return { start: zonedMidnight(year, 1, 1, zone), end: tomorrow };
    case "last_12":
      return { start: zonedMidnight(year, month - 11, 1, zone), end: zonedMidnight(year, month + 1, 1, zone) };
    case "all":
    default:
      return { start: new Date("2000-01-01T00:00:00Z"), end: tomorrow };
  }
}

export function hoursBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getTime() - a.getTime()) / 3_600_000);
}

/** Parses an <input type="datetime-local"> value as wall-clock time in the business zone. */
export function parseLocalDateTime(v: string | null | undefined, zone = tz()): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  // Resolve offset at the target wall time (handles DST correctly).
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const off1 = tzOffsetMinutes(guess, zone);
  const candidate = new Date(guess.getTime() - off1 * 60000);
  const off2 = tzOffsetMinutes(candidate, zone);
  return off1 === off2 ? candidate : new Date(guess.getTime() - off2 * 60000);
}

/** Formats an instant for an <input type="datetime-local"> in the business zone. */
export function toLocalInputValue(d: Date | string | null | undefined, zone = tz()): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(d));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** "2026-10-02" in the business zone. */
export function localDateString(d: Date = new Date(), zone = tz()): string {
  const { year, month, day } = zonedParts(d, zone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** "2026-10" month key in the business zone. */
export function monthKey(d: Date, zone = tz()): string {
  const { year, month } = zonedParts(d, zone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y!, (m ?? 1) - 1, 15)),
  );
}

/** Ordered list of month keys covering [start, end). */
export function monthKeysBetween(start: Date, end: Date, zone = tz()): string[] {
  const keys: string[] = [];
  const s = zonedParts(start, zone);
  let y = s.year;
  let m = s.month;
  const endKey = monthKey(new Date(end.getTime() - 1), zone);
  for (let i = 0; i < 600; i++) {
    const k = `${y}-${String(m).padStart(2, "0")}`;
    keys.push(k);
    if (k >= endKey) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}
