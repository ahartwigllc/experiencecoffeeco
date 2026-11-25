import type Stripe from "stripe";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getVariantsWithProducts } from "./catalog";
import { formatBillingDay, nextBillingDay, WEDNESDAY_NOTE } from "./billing-day";
import { greenGramsPerUnit, unitsFromGreenStock } from "./bean-stock";
import { inStock, variantLabel } from "./catalog-utils";
import { getCustomerEmail } from "./customer-auth";
import { siteUrl } from "./env";
import { formatCents } from "./money";
import {
  INTERVALS,
  subscriberPrice,
  isDeliveryZip,
  normalizeZip,
  resolveSubscriptionDiscount,
  validateCartShape,
  type Interval,
} from "./pricing";
import { getSettings } from "./settings";
import { stripe } from "./stripe";

export const checkoutSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(50),
        interval: z.enum(["week", "2week", "month"]).nullable().default(null),
      }),
    )
    .min(1)
    .max(30),
  fulfillment: z.enum(["pickup", "delivery", "shipping"]),
  deliveryZip: z.string().max(10).optional().nullable(),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;

export class CheckoutError extends Error {}

function absoluteImage(url: string | undefined): string[] | undefined {
  if (!url) return undefined;
  const abs = url.startsWith("http") ? url : `${siteUrl()}${url.startsWith("/") ? "" : "/"}${url}`;
  return abs.startsWith("https://") ? [abs] : undefined; // Stripe requires public https images
}

export type CheckoutOptions = {
  /** Check out as this email (e.g. a one-click restart link) instead of the signed-in customer. */
  email?: string;
  /** Start subscription billing on this date (nothing charged at checkout). */
  firstCharge?: Date;
  /** A former Shopify subscriber moving over. */
  legacy?: boolean;
  /** Extra line shown above the pay button. */
  note?: string;
};

export async function createCheckoutSession(input: CheckoutInput, opts: CheckoutOptions = {}): Promise<string> {
  const settings = await getSettings();
  const shape = validateCartShape(input.lines);
  if (!shape.ok) throw new CheckoutError(shape.error);

  // Merge duplicate lines (same variant + same schedule).
  const merged = new Map<string, { variantId: number; quantity: number; interval: Interval | null }>();
  for (const l of input.lines) {
    const key = `${l.variantId}:${l.interval ?? "once"}`;
    const prev = merged.get(key);
    merged.set(key, { ...l, quantity: (prev?.quantity ?? 0) + l.quantity });
  }
  const lines = [...merged.values()];

  const rows = await getVariantsWithProducts(lines.map((l) => l.variantId));
  const byId = new Map(rows.map((r) => [r.variant.id, r]));

  const interval = lines.find((l) => l.interval)?.interval ?? null;
  const isSubscription = Boolean(interval);
  const taxOn = settings.taxMode === "stripe_tax";

  // Stock is checked across all lines for the same variant.
  const qtyByVariant = new Map<number, number>();
  for (const l of lines) qtyByVariant.set(l.variantId, (qtyByVariant.get(l.variantId) ?? 0) + l.quantity);

  const greenNeeded = new Map<number, number>();
  for (const l of lines) {
    const r = byId.get(l.variantId);
    if (!r || r.product.greenStockGrams === null) continue;
    const per = greenGramsPerUnit(r.variant.size);
    if (per !== null) greenNeeded.set(r.product.id, (greenNeeded.get(r.product.id) ?? 0) + per * l.quantity);
  }

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  let subtotal = 0;
  for (const l of lines) {
    const r = byId.get(l.variantId);
    if (!r || !r.variant.active || r.product.status !== "active")
      throw new CheckoutError("An item in your cart is no longer available. Remove it and try again.");
    const label = variantLabel(r.variant);
    const name = r.product.title;
    const perUnit = r.product.greenStockGrams !== null ? greenGramsPerUnit(r.variant.size) : null;
    if (perUnit !== null) {
      // Roasted to order: every size and grind of this coffee shares one green-coffee stock.
      if ((greenNeeded.get(r.product.id) ?? 0) > r.product.greenStockGrams! + 0.5) {
        const left = unitsFromGreenStock(r.product.greenStockGrams!, r.variant.size) ?? 0;
        throw new CheckoutError(
          left > 0
            ? `We only have enough ${name} left for ${left} more ${r.variant.size} bag${left === 1 ? "" : "s"}. Lower the quantity to continue.`
            : `${name} is sold out until our next green coffee delivery. Remove it to continue.`,
        );
      }
    } else if (!inStock(r.variant, qtyByVariant.get(r.variant.id) ?? l.quantity))
      throw new CheckoutError(
        `${name}${label ? ` (${label})` : ""} has only ${Math.max(r.variant.inventory, 0)} left. Lower the quantity to continue.`,
      );
    if (l.interval) {
      if (!r.product.subscriptionEnabled) throw new CheckoutError(`${name} isn't available as a subscription.`);
      if (!settings.subscriptionIntervals.includes(l.interval))
        throw new CheckoutError("That delivery schedule isn't offered right now. Pick another schedule in your cart.");
    }
    const unit = l.interval
      ? subscriberPrice(
          r.variant.priceCents,
          resolveSubscriptionDiscount(r.product, settings.subscriptionDiscountPercent),
          r.variant.noSubscriptionDiscount,
        )
      : r.variant.priceCents;
    subtotal += unit * l.quantity;
    lineItems.push({
      quantity: l.quantity,
      price_data: {
        currency: "usd",
        unit_amount: unit,
        ...(taxOn ? { tax_behavior: "exclusive" as const } : {}),
        ...(l.interval ? { recurring: INTERVALS[l.interval].stripe } : {}),
        product_data: {
          name,
          ...(label ? { description: label } : {}),
          images: absoluteImage(r.product.images[0]),
          metadata: { variantId: String(r.variant.id), productId: String(r.product.id) },
          ...(taxOn && r.product.taxCode ? { tax_code: r.product.taxCode } : {}),
        },
      },
    });
  }

  // Fulfillment rules.
  let feeCents = 0;
  let feeLabel = "";
  const zip = normalizeZip(input.deliveryZip);
  if (input.fulfillment === "pickup") {
    if (!settings.pickupEnabled) throw new CheckoutError("Pickup isn't available right now.");
  } else if (input.fulfillment === "delivery") {
    if (!settings.deliveryEnabled) throw new CheckoutError("Local delivery isn't available right now.");
    if (!isDeliveryZip(zip, settings.deliveryZips))
      throw new CheckoutError("We don't deliver to that ZIP code yet. Choose pickup instead.");
    if (settings.deliveryMinimumCents && subtotal < settings.deliveryMinimumCents)
      throw new CheckoutError(`Local delivery needs an order of at least ${formatCents(settings.deliveryMinimumCents)}.`);
    feeCents = settings.deliveryFeeCents;
    feeLabel = "Local delivery";
  } else {
    if (!settings.shippingEnabled) throw new CheckoutError("Shipping isn't available right now.");
    feeCents = settings.freeShippingOverCents && subtotal >= settings.freeShippingOverCents ? 0 : settings.shippingFlatCents;
    feeLabel = "Shipping";
  }

  // Cold brew subscriptions bill on Wednesdays: nothing is charged at checkout, the first charge
  // (and order) happens on the next Wednesday, then every interval after on Wednesday.
  const wednesday = isSubscription && lines.some((l) => l.interval && byId.get(l.variantId)?.product.kind === "cold_brew");
  if (wednesday && lines.some((l) => !l.interval))
    throw new CheckoutError(
      "Cold brew subscriptions are billed on Wednesdays, so they check out on their own. Remove the one-time items, or buy them in a separate order.",
    );
  const firstCharge = isSubscription ? (opts.firstCharge ?? (wednesday ? nextBillingDay() : null)) : null;

  const metadata: Record<string, string> = { fulfillment: input.fulfillment, deliveryZip: zip };
  if (firstCharge) metadata.billing = wednesday ? "wednesday" : "anchored";
  if (opts.legacy) metadata.legacy = "1";
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: isSubscription ? "subscription" : "payment",
    line_items: lineItems,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    phone_number_collection: { enabled: true },
    success_url: `${siteUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl()}/cart`,
    metadata,
    automatic_tax: { enabled: taxOn },
  };

  if (input.fulfillment !== "pickup") {
    params.shipping_address_collection = { allowed_countries: ["US"] };
    if (isSubscription) {
      // Checkout only supports shipping_options in payment mode, so a delivery fee
      // on a subscription becomes its own recurring line.
      if (feeCents > 0)
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: feeCents,
            recurring: INTERVALS[interval!].stripe,
            product_data: { name: feeLabel, metadata: { kind: "fee" } },
          },
        });
    } else {
      params.shipping_options = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: feeCents, currency: "usd" },
            display_name: feeCents === 0 ? `${feeLabel} (free)` : feeLabel,
          },
        },
      ];
    }
  } else {
    params.custom_text = { submit: { message: `Pickup at ${settings.pickupAddress}. ${settings.pickupInstructions}` } };
  }

  if (isSubscription) {
    params.subscription_data = { metadata };
    if (firstCharge) {
      params.subscription_data.billing_cycle_anchor = Math.floor(firstCharge.getTime() / 1000);
      params.subscription_data.proration_behavior = "none";
      const note = [
        opts.note,
        wednesday ? WEDNESDAY_NOTE : null,
        `Nothing is charged today. Your first charge is ${formatBillingDay(firstCharge)}.`,
      ]
        .filter(Boolean)
        .join(" ");
      const submit = params.custom_text?.submit;
      const prior = submit ? submit.message : undefined;
      params.custom_text = { submit: { message: prior ? `${note} ${prior}` : note } };
    }
  } else {
    params.customer_creation = "always";
    params.payment_intent_data = { metadata };
  }

  // Signed-in customers check out against their existing Stripe customer.
  const email = opts.email ?? (await getCustomerEmail());
  if (email) {
    const c = await db().query.customers.findFirst({ where: eq(schema.customers.email, email) });
    if (c?.stripeCustomerId) {
      params.customer = c.stripeCustomerId;
      delete params.customer_creation;
      params.customer_update = { shipping: "auto", address: "auto", name: "auto" };
    } else {
      params.customer_email = email;
    }
  }

  const session = await stripe().checkout.sessions.create(params);
  if (!session.url) throw new CheckoutError("Checkout couldn't start. Try again in a moment.");
  return session.url;
}
