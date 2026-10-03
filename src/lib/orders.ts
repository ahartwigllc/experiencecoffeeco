import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Order, OrderItem } from "@/db/schema";
import { formatDate } from "./dates";
import { button, emailLayout, sendEmail } from "./email";
import { siteUrl } from "./env";
import { escapeHtml } from "./markdown";
import { formatCents } from "./money";
import { INTERVALS, isInterval } from "./pricing";
import { getSettings, type Settings } from "./settings";

export type NewOrder = typeof schema.orders.$inferInsert;
export type NewOrderItem = Omit<typeof schema.orderItems.$inferInsert, "orderId">;

function pgCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

function constraintOf(err: unknown): string {
  const e = err as { constraint?: string; message?: string; cause?: { constraint?: string; message?: string } };
  return e?.constraint ?? e?.cause?.constraint ?? e?.message ?? e?.cause?.message ?? "";
}

/**
 * Inserts an order with the next sequential number (continuing from Shopify's #10xx).
 * Retries if two orders race for the same number. If the insert collides on a
 * Stripe id (duplicate webhook delivery), returns the existing order's id.
 */
export async function insertOrder(values: Omit<NewOrder, "number">): Promise<{ id: number; created: boolean }> {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const [row] = await db()
        .insert(schema.orders)
        .values({
          ...values,
          number: sql`(select coalesce(max(${schema.orders.number}), 1000) + 1 from ${schema.orders})`,
        } as unknown as NewOrder)
        .returning({ id: schema.orders.id });
      return { id: row!.id, created: true };
    } catch (err) {
      if (pgCode(err) !== "23505") throw err;
      const c = constraintOf(err);
      if (c.includes("number")) continue;
      const existing =
        (values.stripeCheckoutSessionId &&
          (await db().query.orders.findFirst({ where: eq(schema.orders.stripeCheckoutSessionId, values.stripeCheckoutSessionId) }))) ||
        (values.stripeInvoiceId &&
          (await db().query.orders.findFirst({ where: eq(schema.orders.stripeInvoiceId, values.stripeInvoiceId) }))) ||
        (values.shopifyId && (await db().query.orders.findFirst({ where: eq(schema.orders.shopifyId, values.shopifyId) })));
      if (existing) return { id: existing.id, created: false };
      throw err;
    }
  }
  throw new Error("Could not allocate an order number after several attempts.");
}

export async function insertOrderItems(orderId: number, items: NewOrderItem[]): Promise<void> {
  if (!items.length) return;
  await db().insert(schema.orderItems).values(items.map((i) => ({ ...i, orderId })));
}

/** Decrements stock for tracked variants. Stock may go negative; admin flags it. */
export async function decrementInventory(items: { variantId?: number | null; quantity: number }[]): Promise<void> {
  for (const i of items) {
    if (!i.variantId) continue;
    await db()
      .update(schema.variants)
      .set({ inventory: sql`${schema.variants.inventory} - ${i.quantity}`, updatedAt: sql`now()` })
      .where(sql`${schema.variants.id} = ${i.variantId} and ${schema.variants.trackInventory} = true`);
  }
}

export async function restockInventory(items: { variantId: number | null; quantity: number }[]): Promise<void> {
  await decrementInventory(items.map((i) => ({ ...i, quantity: -i.quantity })));
}

export async function getOrderWithItems(id: number) {
  return db().query.orders.findFirst({ where: eq(schema.orders.id, id), with: { items: true, customer: true } });
}

/* ------------------------------------------------------------------ emails */

export function fulfillmentSummary(o: Pick<Order, "fulfillmentMethod" | "address1" | "address2" | "city" | "state" | "zip">, s: Settings): string {
  if (o.fulfillmentMethod === "pickup") return `Pickup at ${s.pickupAddress}. ${s.pickupInstructions}`;
  const addr = [o.address1, o.address2, [o.city, o.state].filter(Boolean).join(", "), o.zip].filter(Boolean).join(", ");
  return o.fulfillmentMethod === "delivery" ? `Local delivery to ${addr}. ${s.deliveryNote}` : `Shipping to ${addr}.`;
}

function itemsTable(items: OrderItem[]): string {
  const rows = items
    .map((i) => {
      const interval = i.subscriptionInterval && isInterval(i.subscriptionInterval) ? ` (subscription, ${INTERVALS[i.subscriptionInterval].short})` : "";
      return `<tr><td style="padding:6px 0;">${i.quantity} × ${escapeHtml(i.title)}${i.variantTitle ? `<br><span style="color:#6B5E57;font-size:14px;">${escapeHtml(i.variantTitle)}${interval}</span>` : interval}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;">${formatCents(i.totalCents)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E4E8DA;border-bottom:1px solid #E4E8DA;margin:16px 0;">${rows}</table>`;
}

function totalsTable(o: Order): string {
  const line = (label: string, v: string, bold = false) =>
    `<tr><td style="padding:2px 0;${bold ? "font-weight:700;" : ""}">${label}</td><td style="padding:2px 0;text-align:right;${bold ? "font-weight:700;" : ""}">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${line("Subtotal", formatCents(o.subtotalCents))}
${o.discountCents ? line(`Discount${o.discountCodes.length ? ` (${escapeHtml(o.discountCodes.join(", "))})` : ""}`, `−${formatCents(o.discountCents)}`) : ""}
${o.shippingCents ? line(o.fulfillmentMethod === "shipping" ? "Shipping" : "Delivery", formatCents(o.shippingCents)) : ""}
${o.taxCents ? line("Tax", formatCents(o.taxCents)) : ""}
${line("Total", formatCents(o.totalCents), true)}
</table>`;
}

export async function sendOrderEmails(orderId: number): Promise<void> {
  const order = await getOrderWithItems(orderId);
  if (!order) return;
  const s = await getSettings();
  const body = `<p>${order.source === "subscription" ? "Your subscription renewed and a fresh order is on the way." : "Thanks for your order. Here's what you got."}</p>
${itemsTable(order.items)}
${totalsTable(order)}
<p style="margin-top:16px;">${escapeHtml(fulfillmentSummary(order, s))}</p>
${button("View your orders", `${siteUrl()}/account`)}
<p style="font-size:14px;color:#6B5E57;">Questions? Reply to this email or write to ${escapeHtml(s.supportEmail)}.</p>`;

  if (order.email) {
    await sendEmail({
      to: order.email,
      subject: `Order #${order.number} confirmed`,
      replyTo: s.supportEmail,
      html: emailLayout({ title: `Order #${order.number}`, bodyHtml: body, preview: `We received order #${order.number}.` }),
    });
  }
  if (s.ownerNotifyEmail) {
    const who = order.shipName || order.email || order.phone || "a customer";
    await sendEmail({
      to: s.ownerNotifyEmail,
      subject: `New ${order.source === "subscription" ? "subscription renewal" : "order"} #${order.number}: ${formatCents(order.totalCents)} (${order.fulfillmentMethod})`,
      html: emailLayout({
        title: `New order #${order.number}`,
        bodyHtml: `<p>From ${escapeHtml(who)} on ${formatDate(order.createdAt)}.</p>${order.needsReview ? `<p style="color:#8E1C2E;"><strong>Needs review:</strong> ${escapeHtml(order.reviewReason ?? "")}</p>` : ""}${itemsTable(order.items)}${totalsTable(order)}<p>${escapeHtml(fulfillmentSummary(order, s))}</p>${button("Open in admin", `${siteUrl()}/admin/orders/${order.id}`)}`,
      }),
    });
  }
}

export async function sendOrderReadyEmail(orderId: number): Promise<{ ok: boolean; error?: string }> {
  const order = await getOrderWithItems(orderId);
  if (!order?.email) return { ok: false, error: "This order has no email address." };
  const s = await getSettings();
  const title =
    order.fulfillmentMethod === "pickup" ? `Order #${order.number} is ready for pickup` : `Order #${order.number} is out for delivery`;
  const body =
    order.fulfillmentMethod === "pickup"
      ? `<p>Your order is ready. Pick it up at <strong>${escapeHtml(s.pickupAddress)}</strong>.</p>`
      : `<p>Your order is on its way to ${escapeHtml([order.address1, order.city].filter(Boolean).join(", "))}.</p>`;
  const r = await sendEmail({
    to: order.email,
    subject: title,
    replyTo: s.supportEmail,
    html: emailLayout({ title, bodyHtml: body + itemsTable(order.items) }),
  });
  return { ok: r.ok, error: r.error };
}
