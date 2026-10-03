import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireEnv } from "@/lib/env";
import { stripe, stripeCrypto } from "@/lib/stripe";
import { handleChargeRefunded, handleCheckoutCompleted, handleInvoicePaid, upsertSubscription } from "@/lib/stripe-sync";

/**
 * Configure in Stripe Dashboard > Developers > Webhooks with these events:
 * checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid,
 * customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
 * customer.subscription.paused, customer.subscription.resumed, charge.refunded
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(
      body,
      signature ?? "",
      requireEnv("STRIPE_WEBHOOK_SECRET"),
      undefined,
      stripeCrypto,
    );
  } catch (err) {
    console.error("Stripe webhook signature check failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const seen = await db().query.stripeEvents.findFirst({ where: eq(schema.stripeEvents.id, event.id) });
  if (seen) return new Response("Already processed", { status: 200 });

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object.id);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object.id!);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await upsertSubscription(event.data.object.id);
        break;
      case "charge.refunded":
        await handleChargeRefunded(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    // A 500 makes Stripe retry with backoff; all handlers are idempotent.
    console.error(`Stripe webhook ${event.type} (${event.id}) failed`, err);
    return new Response("Handler error", { status: 500 });
  }

  await db().insert(schema.stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
  return new Response("ok", { status: 200 });
}
