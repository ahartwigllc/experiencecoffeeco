import type Stripe from "stripe";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { upsertCustomer } from "./customers";
import { normalizeEmail } from "./http";
import { decrementInventory, insertOrder, insertOrderItems, sendOrderEmails, type NewOrderItem } from "./orders";
import { intervalFromStripe, isDeliveryZip, normalizeZip } from "./pricing";
import { getSettings } from "./settings";
import { stripe } from "./stripe";

type Method = "delivery" | "pickup" | "shipping";

function asMethod(v: unknown): Method {
  return v === "delivery" || v === "shipping" ? v : "pickup";
}

function idOf(x: string | { id: string } | null | undefined): string | null {
  if (!x) return null;
  return typeof x === "string" ? x : x.id;
}

export function feeFromCharge(charge: Stripe.Charge | null | undefined): number | null {
  const bt = charge?.balance_transaction;
  if (bt && typeof bt !== "string") return bt.fee;
  return null;
}

async function feeForChargeId(chargeId: string | null): Promise<number | null> {
  if (!chargeId) return null;
  const ch = await stripe().charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  return feeFromCharge(ch);
}

type LineLike = {
  quantity: number | null;
  amount: number; // line total before order-level discounts
  unitAmount: number | null;
  description: string | null;
  price: Stripe.Price | null;
};

/** Converts Stripe line items into our order items, splitting out delivery-fee lines. */
async function buildItems(lines: LineLike[]): Promise<{ items: NewOrderItem[]; feeLinesCents: number; itemsSubtotal: number }> {
  const parsed = lines.map((l) => {
    const product = l.price?.product && typeof l.price.product !== "string" ? (l.price.product as Stripe.Product) : null;
    const meta = product?.metadata ?? {};
    return {
      l,
      product,
      isFee: meta.kind === "fee",
      variantId: Number(meta.variantId) || null,
      productId: Number(meta.productId) || null,
      interval: intervalFromStripe(l.price?.recurring?.interval, l.price?.recurring?.interval_count),
    };
  });
  const ids = parsed.map((p) => p.variantId).filter((x): x is number => !!x);
  const variants = ids.length ? await db().select().from(schema.variants).where(inArray(schema.variants.id, ids)) : [];
  const byId = new Map(variants.map((v) => [v.id, v]));

  let feeLinesCents = 0;
  let itemsSubtotal = 0;
  const items: NewOrderItem[] = [];
  for (const p of parsed) {
    if (p.isFee) {
      feeLinesCents += p.l.amount;
      continue;
    }
    const qty = p.l.quantity ?? 1;
    const v = p.variantId ? byId.get(p.variantId) : undefined;
    itemsSubtotal += p.l.amount;
    items.push({
      productId: v?.productId ?? p.productId,
      variantId: v?.id ?? null,
      title: p.product?.name ?? p.l.description ?? "Item",
      variantTitle: p.product?.description ?? null,
      quantity: qty,
      unitPriceCents: p.l.unitAmount ?? Math.round(p.l.amount / Math.max(qty, 1)),
      totalCents: p.l.amount,
      unitCostCents: v?.unitCostCents ?? null,
      subscriptionInterval: p.interval,
    });
  }
  return { items, feeLinesCents, itemsSubtotal };
}

async function discountCodesFrom(discounts: (Stripe.Discount | string | null | undefined)[]): Promise<string[]> {
  const codes: string[] = [];
  for (const d of discounts) {
    if (!d || typeof d === "string") continue;
    const promoId = idOf(d.promotion_code as string | Stripe.PromotionCode | null);
    if (promoId) {
      const c = await db().query.coupons.findFirst({ where: eq(schema.coupons.stripePromotionCodeId, promoId) });
      if (c) {
        codes.push(c.code);
        continue;
      }
      if (d.promotion_code && typeof d.promotion_code !== "string") {
        codes.push(d.promotion_code.code);
        continue;
      }
    }
    codes.push(d.coupon?.name || d.coupon?.id || "discount");
  }
  return [...new Set(codes)];
}

/* --------------------------------------------------------- subscriptions */

export async function upsertSubscription(
  subscriptionId: string,
  extra?: {
    customerId?: number | null;
    method?: Method;
    address?: { name?: string | null; line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null } | null;
  },
): Promise<number> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId, { expand: ["items.data.price.product"] });
  const first = sub.items.data.find((i) => {
    const prod = i.price.product;
    return !(prod && typeof prod !== "string" && "metadata" in prod && prod.metadata?.kind === "fee");
  });
  const interval = intervalFromStripe(first?.price.recurring?.interval, first?.price.recurring?.interval_count) ?? "month";

  let customerId = extra?.customerId ?? null;
  if (!customerId) {
    const sc = idOf(sub.customer as string | Stripe.Customer);
    if (sc) {
      const c = await db().query.customers.findFirst({ where: eq(schema.customers.stripeCustomerId, sc) });
      customerId = c?.id ?? null;
    }
  }

  const base = {
    status: sub.status,
    interval,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    paused: Boolean(sub.pause_collection),
    updatedAt: new Date(),
  };
  const addr = extra?.address
    ? {
        shipName: extra.address.name ?? null,
        address1: extra.address.line1 ?? null,
        address2: extra.address.line2 ?? null,
        city: extra.address.city ?? null,
        state: extra.address.state ?? null,
        zip: extra.address.postal_code ?? null,
      }
    : {};

  const existing = await db().query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, sub.id) });
  let id: number;
  if (existing) {
    id = existing.id;
    await db()
      .update(schema.subscriptions)
      .set({ ...base, ...addr, ...(customerId ? { customerId } : {}), ...(extra?.method ? { fulfillmentMethod: extra.method } : {}) })
      .where(eq(schema.subscriptions.id, id));
  } else {
    const [row] = await db()
      .insert(schema.subscriptions)
      .values({
        stripeSubscriptionId: sub.id,
        customerId,
        fulfillmentMethod: extra?.method ?? asMethod(sub.metadata?.fulfillment),
        ...base,
        ...addr,
      })
      .onConflictDoUpdate({ target: schema.subscriptions.stripeSubscriptionId, set: base })
      .returning({ id: schema.subscriptions.id });
    id = row!.id;
  }

  // Replace line items with Stripe's current view.
  await db().delete(schema.subscriptionItems).where(eq(schema.subscriptionItems.subscriptionId, id));
  const rows = sub.items.data
    .map((i) => {
      const prod = i.price.product && typeof i.price.product !== "string" ? (i.price.product as Stripe.Product) : null;
      if (prod?.metadata?.kind === "fee") return null;
      return {
        subscriptionId: id,
        stripeSubscriptionItemId: i.id,
        variantId: Number(prod?.metadata?.variantId) || null,
        title: [prod?.name, prod?.description].filter(Boolean).join(" — ") || "Subscription item",
        quantity: i.quantity ?? 1,
        unitPriceCents: i.price.unit_amount ?? 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (rows.length) await db().insert(schema.subscriptionItems).values(rows);
  return id;
}

/* ------------------------------------------------------------- checkout */

export async function handleCheckoutCompleted(sessionId: string): Promise<void> {
  const session = await stripe().checkout.sessions.retrieve(sessionId, {
    expand: [
      "line_items.data.price.product",
      "total_details.breakdown",
      "payment_intent.latest_charge.balance_transaction",
      "invoice.charge.balance_transaction",
    ],
  });
  if (session.payment_status === "unpaid") return; // waits for async_payment_succeeded

  const existing = await db().query.orders.findFirst({
    where: eq(schema.orders.stripeCheckoutSessionId, session.id),
    with: { items: true },
  });
  if (existing && existing.items.length > 0) return;

  const settings = await getSettings();
  const meta = session.metadata ?? {};
  const method = asMethod(meta.fulfillment);
  const ship = session.shipping_details;
  const cd = session.customer_details;
  const email = normalizeEmail(cd?.email ?? session.customer_email);
  const stripeCustomerId = idOf(session.customer as string | Stripe.Customer | null);

  const customerId = await upsertCustomer({
    email,
    phone: cd?.phone ?? null,
    name: ship?.name ?? cd?.name ?? null,
    stripeCustomerId,
    address: method === "pickup" ? null : ship?.address ?? null,
  });

  const pi = session.payment_intent && typeof session.payment_intent !== "string" ? session.payment_intent : null;
  const invoice = session.invoice && typeof session.invoice !== "string" ? session.invoice : null;
  let charge: Stripe.Charge | null = null;
  if (pi?.latest_charge && typeof pi.latest_charge !== "string") charge = pi.latest_charge;
  if (!charge && invoice?.charge && typeof invoice.charge !== "string") charge = invoice.charge;
  const amountTotal = session.amount_total ?? 0;
  const feeCents = amountTotal === 0 ? 0 : feeFromCharge(charge);

  const { items, feeLinesCents, itemsSubtotal } = await buildItems(
    (session.line_items?.data ?? []).map((li) => ({
      quantity: li.quantity,
      amount: li.amount_subtotal,
      unitAmount: li.price?.unit_amount ?? null,
      description: li.description,
      price: li.price,
    })),
  );

  const codes = await discountCodesFrom((session.total_details?.breakdown?.discounts ?? []).map((d) => d.discount));

  let needsReview = false;
  let reviewReason: string | null = null;
  const zip = normalizeZip(ship?.address?.postal_code);
  if (method === "delivery" && !isDeliveryZip(zip, settings.deliveryZips)) {
    needsReview = true;
    reviewReason = `Delivery address ZIP ${zip || "(none)"} is outside your delivery area. Contact the customer to arrange pickup or refund.`;
  }

  const values = {
    source: "web" as const,
    status: "paid" as const,
    fulfillmentMethod: method,
    customerId,
    email,
    phone: cd?.phone ?? null,
    shipName: ship?.name ?? cd?.name ?? null,
    address1: method === "pickup" ? null : ship?.address?.line1 ?? null,
    address2: method === "pickup" ? null : ship?.address?.line2 ?? null,
    city: method === "pickup" ? null : ship?.address?.city ?? null,
    state: method === "pickup" ? null : ship?.address?.state ?? null,
    zip: method === "pickup" ? null : zip || null,
    country: method === "pickup" ? null : ship?.address?.country ?? null,
    subtotalCents: itemsSubtotal,
    discountCents: session.total_details?.amount_discount ?? 0,
    shippingCents: (session.total_details?.amount_shipping ?? 0) + feeLinesCents,
    taxCents: session.total_details?.amount_tax ?? 0,
    totalCents: amountTotal,
    feeCents,
    paymentMethod: "stripe",
    discountCodes: codes,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: pi?.id ?? (invoice ? idOf(invoice.payment_intent as string | Stripe.PaymentIntent | null) : null),
    stripeChargeId: charge?.id ?? null,
    stripeInvoiceId: invoice?.id ?? null,
    stripeSubscriptionId: idOf(session.subscription as string | Stripe.Subscription | null),
    needsReview,
    reviewReason,
  };

  let orderId: number;
  if (existing) {
    orderId = existing.id;
  } else {
    const r = await insertOrder(values);
    orderId = r.id;
    const check = await db().query.orders.findFirst({ where: eq(schema.orders.id, orderId), with: { items: true } });
    if (check && check.items.length > 0) return; // a concurrent delivery already finished the job
  }

  await insertOrderItems(orderId, items);
  await decrementInventory(items);

  if (values.stripeSubscriptionId) {
    await upsertSubscription(values.stripeSubscriptionId, {
      customerId,
      method,
      address: method === "pickup" ? null : { name: ship?.name, ...ship?.address },
    });
  }

  await sendOrderEmails(orderId);
}

/* -------------------------------------------------------------- renewals */

export async function handleInvoicePaid(invoiceId: string): Promise<void> {
  const invoice = await stripe().invoices.retrieve(invoiceId, {
    expand: ["lines.data.price.product", "charge.balance_transaction", "discounts"],
  });
  // First invoice is recorded from checkout.session.completed.
  if (invoice.billing_reason !== "subscription_cycle") return;
  const subId = idOf(invoice.subscription as string | Stripe.Subscription | null);
  if (!subId) return;

  const already = await db().query.orders.findFirst({ where: eq(schema.orders.stripeInvoiceId, invoice.id) });
  if (already) return;

  let sub = await db().query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, subId) });
  if (!sub) {
    await upsertSubscription(subId);
    sub = await db().query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, subId) });
  } else {
    await upsertSubscription(subId); // refresh period end / status
  }
  const customer = sub?.customerId ? await db().query.customers.findFirst({ where: eq(schema.customers.id, sub.customerId) }) : null;

  const { items, feeLinesCents, itemsSubtotal } = await buildItems(
    invoice.lines.data.map((l) => ({
      quantity: l.quantity,
      amount: l.amount,
      unitAmount: l.price?.unit_amount ?? null,
      description: l.description,
      price: l.price,
    })),
  );
  const charge = invoice.charge && typeof invoice.charge !== "string" ? invoice.charge : null;
  const discountCents = (invoice.total_discount_amounts ?? []).reduce((a, d) => a + d.amount, 0);
  const codes = await discountCodesFrom((invoice.discounts ?? []) as (Stripe.Discount | string)[]);

  const { id: orderId, created } = await insertOrder({
    source: "subscription",
    status: "paid",
    fulfillmentMethod: sub?.fulfillmentMethod ?? "pickup",
    customerId: sub?.customerId ?? null,
    email: normalizeEmail(invoice.customer_email) ?? customer?.email ?? null,
    phone: customer?.phone ?? null,
    shipName: sub?.shipName ?? [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ?? null,
    address1: sub?.address1 ?? null,
    address2: sub?.address2 ?? null,
    city: sub?.city ?? null,
    state: sub?.state ?? null,
    zip: sub?.zip ?? null,
    country: sub?.address1 ? "US" : null,
    subtotalCents: itemsSubtotal,
    discountCents,
    shippingCents: feeLinesCents,
    taxCents: invoice.tax ?? 0,
    totalCents: invoice.amount_paid,
    feeCents: invoice.amount_paid === 0 ? 0 : feeFromCharge(charge),
    paymentMethod: "stripe",
    discountCodes: codes,
    stripeInvoiceId: invoice.id,
    stripeChargeId: charge?.id ?? null,
    stripePaymentIntentId: idOf(invoice.payment_intent as string | Stripe.PaymentIntent | null),
    stripeSubscriptionId: subId,
  });
  if (!created) return;
  await insertOrderItems(orderId, items);
  await decrementInventory(items);
  await sendOrderEmails(orderId);
}

/* --------------------------------------------------------------- refunds */

export async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const piId = idOf(charge.payment_intent as string | Stripe.PaymentIntent | null);
  const invId = idOf(charge.invoice as string | Stripe.Invoice | null);
  const order =
    (await db().query.orders.findFirst({ where: eq(schema.orders.stripeChargeId, charge.id) })) ||
    (piId && (await db().query.orders.findFirst({ where: eq(schema.orders.stripePaymentIntentId, piId) }))) ||
    (invId && (await db().query.orders.findFirst({ where: eq(schema.orders.stripeInvoiceId, invId) })));
  if (!order) {
    console.warn(`charge.refunded: no order for charge ${charge.id}`);
    return;
  }
  const refunded = charge.amount_refunded;
  await db()
    .update(schema.orders)
    .set({
      refundedCents: refunded,
      status: refunded >= charge.amount ? "refunded" : refunded > 0 ? "partially_refunded" : order.status,
      stripeChargeId: order.stripeChargeId ?? charge.id,
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, order.id));
}

/* ------------------------------------------------------------ reconcile */

/** Fills in processor fees that weren't available when the order was created. */
export async function reconcileMissingFees(limit = 50): Promise<{ updated: number; checked: number }> {
  const rows = await db()
    .select({ id: schema.orders.id, chargeId: schema.orders.stripeChargeId, pi: schema.orders.stripePaymentIntentId })
    .from(schema.orders)
    .where(
      and(
        isNull(schema.orders.feeCents),
        sql`(${schema.orders.stripeChargeId} is not null or ${schema.orders.stripePaymentIntentId} is not null)`,
        sql`${schema.orders.status} <> 'cancelled'`,
      ),
    )
    .limit(limit);
  let updated = 0;
  for (const r of rows) {
    try {
      let chargeId = r.chargeId;
      if (!chargeId && r.pi) {
        const pi = await stripe().paymentIntents.retrieve(r.pi);
        chargeId = idOf(pi.latest_charge as string | Stripe.Charge | null);
      }
      const fee = await feeForChargeId(chargeId);
      if (fee !== null) {
        await db().update(schema.orders).set({ feeCents: fee, stripeChargeId: chargeId }).where(eq(schema.orders.id, r.id));
        updated++;
      }
    } catch (err) {
      console.error(`fee reconcile failed for order ${r.id}`, err);
    }
  }
  return { updated, checked: rows.length };
}

/** Keeps coupon redemption counts in the admin in step with Stripe. */
export async function syncCouponRedemptions(): Promise<void> {
  const rows = await db().select().from(schema.coupons).where(isNotNull(schema.coupons.stripePromotionCodeId));
  for (const c of rows) {
    try {
      const p = await stripe().promotionCodes.retrieve(c.stripePromotionCodeId!);
      await db()
        .update(schema.coupons)
        .set({ timesRedeemed: p.times_redeemed, active: p.active })
        .where(eq(schema.coupons.id, c.id));
    } catch (err) {
      console.error(`coupon sync failed for ${c.code}`, err);
    }
  }
}
