import { eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { createSignedToken, readSignedToken } from "./crypto";
import { sessionSecret, siteUrl } from "./env";
import { isInterval, type Interval } from "./pricing";

export type LegacySubscriber = {
  email: string;
  name: string | null;
  last: Date;
  count: number;
  interval: string;
  title: string;
  productId: number | null;
  variantId: number | null;
  quantity: number;
  fulfillment: "pickup" | "delivery" | "shipping";
  zip: string | null;
  /** When Shopify would charge them next, from their last order + schedule. */
  nextDue: Date;
  /** Still subscribed on Shopify (not more than two weeks overdue). */
  active: boolean;
};

export function addInterval(d: Date, interval: string): Date {
  const out = new Date(d);
  if (interval === "week") out.setUTCDate(out.getUTCDate() + 7);
  else if (interval === "2week") out.setUTCDate(out.getUTCDate() + 14);
  else out.setUTCMonth(out.getUTCMonth() + 1);
  return out;
}

/** Former Shopify subscribers, inferred from imported order history. */
export async function listLegacySubscribers(now: Date = new Date()): Promise<LegacySubscriber[]> {
  const rows = await db()
    .select({
      email: schema.orders.email,
      name: schema.orders.shipName,
      createdAt: schema.orders.createdAt,
      method: schema.orders.fulfillmentMethod,
      zip: schema.orders.zip,
      title: schema.orderItems.title,
      variantId: schema.orderItems.variantId,
      productId: schema.orderItems.productId,
      interval: schema.orderItems.subscriptionInterval,
      quantity: schema.orderItems.quantity,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(sql`${schema.orders.source} = 'shopify' and ${schema.orderItems.subscriptionInterval} is not null and ${schema.orders.email} is not null`)
    .orderBy(schema.orders.createdAt);

  const byEmail = new Map<string, LegacySubscriber>();
  for (const r of rows) {
    const e = r.email!.toLowerCase();
    const prev = byEmail.get(e);
    const nextDue = addInterval(r.createdAt, r.interval!);
    byEmail.set(e, {
      email: e,
      name: r.name ?? prev?.name ?? null,
      last: r.createdAt,
      count: (prev?.count ?? 0) + 1,
      interval: r.interval!,
      title: r.title,
      productId: r.productId,
      variantId: r.variantId,
      quantity: r.quantity,
      fulfillment: r.method,
      zip: r.zip ?? prev?.zip ?? null,
      nextDue,
      active: nextDue.getTime() > now.getTime() - 14 * 86400_000,
    });
  }
  // Anyone who already re-subscribed on the new site is no longer "legacy".
  const emails = [...byEmail.keys()];
  if (emails.length) {
    const resubbed = await db()
      .select({ email: schema.customers.email })
      .from(schema.subscriptions)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.subscriptions.customerId))
      .where(inArray(schema.customers.email, emails));
    for (const r of resubbed) if (r.email) byEmail.delete(r.email);
  }
  return [...byEmail.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.nextDue.getTime() - b.nextDue.getTime());
}

const TOKEN_DAYS = 45;

/** One-click "approve" link for a former Shopify subscriber. */
export async function restartUrl(email: string): Promise<string> {
  const t = await createSignedToken({ email, typ: "restart" }, sessionSecret(), TOKEN_DAYS * 86400);
  return `${siteUrl()}/subscribe/restart?t=${encodeURIComponent(t)}`;
}

export async function readRestartToken(t: string | null): Promise<string | null> {
  const p = await readSignedToken<{ email: string; typ: string }>(t, sessionSecret());
  return p && p.typ === "restart" ? p.email : null;
}

export const legacyInterval = (l: LegacySubscriber): Interval => (isInterval(l.interval) ? l.interval : "month");
