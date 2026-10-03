"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { upsertCustomer } from "@/lib/customers";
import { flash } from "@/lib/flash";
import { normalizeEmail } from "@/lib/http";
import { parseDollarsToCents } from "@/lib/money";
import { decrementInventory, insertOrder, insertOrderItems, restockInventory, sendOrderEmails, sendOrderReadyEmail } from "@/lib/orders";
import { variantLabel } from "@/lib/catalog-utils";
import { stripe } from "@/lib/stripe";

const back = (id: number) => `/admin/orders/${id}`;

export async function setFulfillment(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["unfulfilled", "ready", "fulfilled"].includes(status)) flash(back(id), "error", "Unknown fulfillment status.");
  const notify = formData.get("notify") === "on";
  await db()
    .update(schema.orders)
    .set({
      fulfillmentStatus: status as "unfulfilled" | "ready" | "fulfilled",
      readyAt: status === "ready" ? new Date() : undefined,
      fulfilledAt: status === "fulfilled" ? new Date() : status === "unfulfilled" ? null : undefined,
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, id));
  let msg = status === "ready" ? "Marked ready." : status === "fulfilled" ? "Marked fulfilled." : "Marked not fulfilled.";
  if (notify && status === "ready") {
    const r = await sendOrderReadyEmail(id);
    msg += r.ok ? " Customer emailed." : ` Email not sent: ${r.error}`;
  }
  revalidatePath("/admin/orders");
  flash(back(id), "ok", msg);
}

/** Quick action from the orders list: mark several orders fulfilled at once. */
export async function bulkFulfill(formData: FormData) {
  await requireOwner();
  const ids = formData.getAll("ids").map(Number).filter(Boolean);
  if (!ids.length) flash("/admin/orders", "error", "Select at least one order.");
  await db()
    .update(schema.orders)
    .set({ fulfillmentStatus: "fulfilled", fulfilledAt: new Date(), updatedAt: new Date() })
    .where(inArray(schema.orders.id, ids));
  revalidatePath("/admin/orders");
  flash("/admin/orders", "ok", `${ids.length} order${ids.length === 1 ? "" : "s"} marked fulfilled.`);
}

export async function saveNote(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  await db()
    .update(schema.orders)
    .set({ note: String(formData.get("note") ?? "").slice(0, 5000) || null, updatedAt: new Date() })
    .where(eq(schema.orders.id, id));
  flash(back(id), "ok", "Note saved.");
}

export async function clearReview(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  await db().update(schema.orders).set({ needsReview: false, updatedAt: new Date() }).where(eq(schema.orders.id, id));
  flash(back(id), "ok", "Review flag cleared.");
}

export async function resendConfirmation(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  await sendOrderEmails(id);
  flash(back(id), "ok", "Confirmation sent again.");
}

export async function refundOrder(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const order = await db().query.orders.findFirst({ where: eq(schema.orders.id, id) });
  if (!order) flash("/admin/orders", "error", "Order not found.");
  const remaining = order.totalCents - order.refundedCents;
  const amount = parseDollarsToCents(formData.get("amount")) ?? remaining;
  if (amount <= 0 || amount > remaining) flash(back(id), "error", `Refund must be between $0.01 and the remaining ${(remaining / 100).toFixed(2)}.`);

  const restock = formData.get("restock") === "on";
  if (order.paymentMethod === "stripe" && (order.stripeChargeId || order.stripePaymentIntentId)) {
    try {
      await stripe().refunds.create({
        ...(order.stripeChargeId ? { charge: order.stripeChargeId } : { payment_intent: order.stripePaymentIntentId! }),
        amount,
        reason: "requested_by_customer",
        metadata: { orderId: String(order.id), orderNumber: String(order.number) },
      });
    } catch (err) {
      flash(back(id), "error", `Stripe refused the refund: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }
  // Stripe's charge.refunded webhook will confirm this; update now so the page is current.
  const refunded = order.refundedCents + amount;
  await db()
    .update(schema.orders)
    .set({ refundedCents: refunded, status: refunded >= order.totalCents ? "refunded" : "partially_refunded", updatedAt: new Date() })
    .where(eq(schema.orders.id, id));
  if (restock) {
    const items = await db().select().from(schema.orderItems).where(eq(schema.orderItems.orderId, id));
    await restockInventory(items);
  }
  revalidatePath("/admin/orders");
  flash(
    back(id),
    "ok",
    order.paymentMethod === "stripe" ? `Refunded $${(amount / 100).toFixed(2)} through Stripe.` : `Recorded a $${(amount / 100).toFixed(2)} refund. Pay the customer back by ${order.paymentMethod}.`,
  );
}

export async function cancelOrder(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const order = await db().query.orders.findFirst({ where: eq(schema.orders.id, id), with: { items: true } });
  if (!order) flash("/admin/orders", "error", "Order not found.");
  if (order.paymentMethod === "stripe" && order.status !== "pending" && order.refundedCents < order.totalCents)
    flash(back(id), "error", "Refund this card payment in full before cancelling.");
  await db().update(schema.orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(schema.orders.id, id));
  if (formData.get("restock") === "on") await restockInventory(order.items);
  revalidatePath("/admin/orders");
  flash(back(id), "ok", "Order cancelled.");
}

/** Records an in-person, cash, Venmo, or comped order so finance and inventory stay complete. */
export async function createManualOrder(formData: FormData) {
  await requireOwner();
  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const method = String(formData.get("method") ?? "pickup") as "pickup" | "delivery" | "shipping";
  const paymentMethod = String(formData.get("paymentMethod") ?? "cash").slice(0, 40);

  const variantIds: number[] = [];
  const lines: { variantId: number; qty: number; price: number | null }[] = [];
  for (let i = 0; i < 8; i++) {
    const v = Number(formData.get(`variant_${i}`));
    const qty = Number(formData.get(`qty_${i}`));
    if (!v || !qty || qty < 1) continue;
    variantIds.push(v);
    lines.push({ variantId: v, qty: Math.min(qty, 500), price: parseDollarsToCents(formData.get(`price_${i}`)) });
  }
  if (!lines.length) flash("/admin/orders/new", "error", "Add at least one item.");

  const variants = await db()
    .select({ v: schema.variants, p: schema.products })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
    .where(inArray(schema.variants.id, variantIds));
  const byId = new Map(variants.map((r) => [r.v.id, r]));

  const items = lines.map((l) => {
    const r = byId.get(l.variantId)!;
    const unit = l.price ?? r.v.priceCents;
    return {
      productId: r.p.id,
      variantId: r.v.id,
      title: r.p.title,
      variantTitle: variantLabel(r.v) || null,
      quantity: l.qty,
      unitPriceCents: unit,
      totalCents: unit * l.qty,
      unitCostCents: r.v.unitCostCents,
      subscriptionInterval: null,
    };
  });
  const subtotal = items.reduce((a, i) => a + i.totalCents, 0);
  const discount = Math.min(parseDollarsToCents(formData.get("discount")) ?? 0, subtotal);
  const shipping = parseDollarsToCents(formData.get("shipping")) ?? 0;
  const tax = parseDollarsToCents(formData.get("tax")) ?? 0;
  const total = subtotal - discount + shipping + tax;

  const customerId = email || phone ? await upsertCustomer({ email, phone, name }) : null;
  const { id } = await insertOrder({
    source: "manual",
    status: "paid",
    fulfillmentStatus: formData.get("fulfilled") === "on" ? "fulfilled" : "unfulfilled",
    fulfilledAt: formData.get("fulfilled") === "on" ? new Date() : null,
    fulfillmentMethod: ["pickup", "delivery", "shipping"].includes(method) ? method : "pickup",
    customerId,
    email,
    phone,
    shipName: name,
    address1: String(formData.get("address1") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim() || null,
    state: String(formData.get("state") ?? "").trim() || null,
    zip: String(formData.get("zip") ?? "").trim() || null,
    subtotalCents: subtotal,
    discountCents: discount,
    shippingCents: shipping,
    taxCents: tax,
    totalCents: total,
    feeCents: parseDollarsToCents(formData.get("fee")) ?? 0,
    paymentMethod,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  await insertOrderItems(id, items);
  if (formData.get("decrement") === "on") await decrementInventory(items);
  if (formData.get("sendReceipt") === "on" && email) await sendOrderEmails(id);
  revalidatePath("/admin/orders");
  flash(`/admin/orders/${id}`, "ok", "Order recorded.");
}

export async function updateOrderAddress(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const val = (k: string) => String(formData.get(k) ?? "").trim() || null;
  await db()
    .update(schema.orders)
    .set({
      shipName: val("shipName"),
      address1: val("address1"),
      address2: val("address2"),
      city: val("city"),
      state: val("state"),
      zip: val("zip"),
      phone: val("phone"),
      updatedAt: sql`now()`,
    })
    .where(eq(schema.orders.id, id));
  flash(back(id), "ok", "Address updated.");
}
