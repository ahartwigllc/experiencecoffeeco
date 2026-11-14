/**
 * Cold brew subscriptions bill on Wednesdays (brew Thursday into Friday, deliver Saturday).
 * Pure functions so they can be unit tested; times are computed in the store's timezone.
 */
export const BILLING_WEEKDAY = 3; // Wednesday (0 = Sunday)
export const BILLING_HOUR = 9; // 9am local
export const BILLING_TZ = "America/New_York";

function partsIn(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(o.weekday!);
  return { y: +o.year!, m: +o.month!, d: +o.day!, h: +o.hour!, min: +o.minute!, s: +o.second!, wd };
}

/** UTC instant for a wall-clock time in a timezone. */
export function zonedTime(y: number, m: number, d: number, h: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, 0, 0);
  const offsetAt = (t: number) => {
    const p = partsIn(new Date(t), tz);
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - t;
  };
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t); // settle across DST changes
  return new Date(t);
}

/**
 * The next Wednesday 9am (store time) strictly after `now`. Always less than 7 days away,
 * which Stripe requires for a weekly billing anchor.
 */
export function nextBillingDay(now: Date = new Date(), tz = BILLING_TZ): Date {
  const p = partsIn(now, tz);
  let add = (BILLING_WEEKDAY - p.wd + 7) % 7;
  const today = zonedTime(p.y, p.m, p.d, BILLING_HOUR, tz);
  if (add === 0 && now.getTime() >= today.getTime()) add = 7;
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + add, 12));
  return zonedTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), BILLING_HOUR, tz);
}

export function formatBillingDay(d: Date, tz = BILLING_TZ): string {
  return d.toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric" });
}

export const WEDNESDAY_NOTE =
  "Cold brew subscriptions are billed and placed on Wednesdays. We brew Thursday into Friday and deliver on Saturday.";
