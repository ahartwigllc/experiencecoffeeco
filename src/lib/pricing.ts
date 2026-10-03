/**
 * Pure pricing rules shared by the cart (display) and checkout (authoritative).
 * No imports from the database or Stripe so this file is unit-testable.
 */

export type Interval = "week" | "2week" | "month";

export const INTERVALS: Record<
  Interval,
  { label: string; short: string; stripe: { interval: "week" | "month"; interval_count: number }; perMonth: number }
> = {
  week: { label: "Every week", short: "weekly", stripe: { interval: "week", interval_count: 1 }, perMonth: 52 / 12 },
  "2week": { label: "Every 2 weeks", short: "every 2 weeks", stripe: { interval: "week", interval_count: 2 }, perMonth: 26 / 12 },
  month: { label: "Every month", short: "monthly", stripe: { interval: "month", interval_count: 1 }, perMonth: 1 },
};

export function isInterval(v: unknown): v is Interval {
  return v === "week" || v === "2week" || v === "month";
}

/** Maps Stripe recurring settings back to our interval key. */
export function intervalFromStripe(interval?: string | null, count?: number | null): Interval | null {
  if (interval === "week" && (count ?? 1) === 1) return "week";
  if (interval === "week" && count === 2) return "2week";
  if (interval === "month" && (count ?? 1) === 1) return "month";
  return null;
}

/** Shopify selling plan names seen in order history -> interval. */
export function intervalFromShopifyPlan(name?: string | null): Interval | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes("bi-weekly") || n.includes("biweekly") || n.includes("2 week")) return "2week";
  if (n.includes("week")) return "week";
  if (n.includes("month")) return "month";
  return null;
}

export function subscriptionUnitPrice(priceCents: number, discountPercent: number): number {
  const pct = Math.min(Math.max(discountPercent, 0), 90);
  return Math.round((priceCents * (100 - pct)) / 100);
}

export type CartLineInput = { variantId: number; quantity: number; interval: Interval | null };

export const CART_LIMITS = { maxLines: 30, maxQuantity: 50 };

export function validateCartShape(lines: CartLineInput[]): { ok: true } | { ok: false; error: string } {
  if (lines.length === 0) return { ok: false, error: "Your cart is empty." };
  if (lines.length > CART_LIMITS.maxLines) return { ok: false, error: "Your cart has too many lines." };
  for (const l of lines) {
    if (!Number.isInteger(l.variantId) || l.variantId <= 0) return { ok: false, error: "A cart item is invalid." };
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > CART_LIMITS.maxQuantity)
      return { ok: false, error: `Quantities must be between 1 and ${CART_LIMITS.maxQuantity}.` };
  }
  const intervals = new Set(lines.map((l) => l.interval).filter(Boolean));
  if (intervals.size > 1)
    return {
      ok: false,
      error:
        "All subscription items in one order need the same delivery schedule. Change the schedule on one item, or check out separately.",
    };
  return { ok: true };
}

export function normalizeZip(zip: string | null | undefined): string {
  return (zip ?? "").trim().slice(0, 5);
}

export function isDeliveryZip(zip: string | null | undefined, allowed: string[]): boolean {
  const z = normalizeZip(zip);
  return /^\d{5}$/.test(z) && allowed.map(normalizeZip).includes(z);
}

/** Monthly recurring revenue contribution of one subscription line. */
export function monthlyValueCents(unitPriceCents: number, quantity: number, interval: Interval): number {
  return Math.round(unitPriceCents * quantity * INTERVALS[interval].perMonth);
}
