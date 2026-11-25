import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ClearCart } from "@/components/CartLink";
import { db, schema } from "@/db/client";
import { formatBillingDay, nextBillingDay, WEDNESDAY_NOTE } from "@/lib/billing-day";
import { getSettings } from "@/lib/settings";
import { stripe } from "@/lib/stripe";
import { handleCheckoutCompleted } from "@/lib/stripe-sync";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const settings = await getSettings();
  let email: string | null = null;
  let method: string | null = null;
  let orderNumber: number | null = null;
  let firstCharge: string | null = null;
  let wednesdayNote = false;
  let legacy = false;

  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try {
      const s = await stripe().checkout.sessions.retrieve(session_id, { expand: ["subscription"] });
      email = s.customer_details?.email ?? null;
      const billing = s.metadata?.billing;
      if ((billing === "wednesday" || billing === "anchored") && (s.amount_total ?? 0) === 0) {
        const sub = s.subscription && typeof s.subscription !== "string" ? s.subscription : null;
        firstCharge = formatBillingDay(sub?.current_period_end ? new Date(sub.current_period_end * 1000) : nextBillingDay(new Date(s.created * 1000)));
        wednesdayNote = billing === "wednesday";
        legacy = s.metadata?.legacy === "1";
      }
      method = s.metadata?.fulfillment ?? null;
      const find = () => db().query.orders.findFirst({ where: eq(schema.orders.stripeCheckoutSessionId, session_id) });
      let o = await find();
      // Safety net: if the webhook hasn't landed yet (delay, outage, misconfigured secret), record the
      // order now. handleCheckoutCompleted re-reads the session from Stripe, skips unpaid sessions, and
      // is idempotent, so the webhook arriving later does nothing twice.
      if (!o && s.status === "complete" && s.payment_status !== "unpaid") {
        try {
          await handleCheckoutCompleted(session_id);
          o = await find();
        } catch (err) {
          console.error("Success page could not record order", session_id, err);
        }
      }
      orderNumber = o?.number ?? null;
    } catch {
      /* show generic thanks */
    }
  }

  return (
    <div className="wrap narrow">
      <ClearCart />
      <div className="page-head">
        <h1>Thank you{orderNumber ? `. Order #${orderNumber} is in.` : "."}</h1>
      </div>
      {firstCharge ? (
        <p className="lede">
          {legacy ? "Thanks for approving the move. Your subscription carries on right where it left off." : "Your subscription is set."}{" "}
          {wednesdayNote ? `${WEDNESDAY_NOTE} ` : ""}Nothing was charged today: your next charge and order go through on{" "}
          <strong>{firstCharge}</strong>, and we&apos;ll email you two days before each charge.{email ? ` A confirmation is on its way to ${email}.` : ""}
        </p>
      ) : (
      <p className="lede">
        {email ? `A receipt is on its way to ${email}. ` : "A receipt is on its way to your inbox. "}
        {method === "pickup"
          ? `We'll email you when it's ready to pick up at ${settings.pickupAddress}.`
          : method === "delivery"
            ? "We'll bring it to you within a day or two and email you when it's on the way."
            : "We'll email you when it ships."}
      </p>
      )}
      <div className="buy-row">
        <Link className="btn" href="/account">
          See your orders
        </Link>
        <Link className="btn btn-ghost" href="/shop">
          Keep shopping
        </Link>
      </div>
    </div>
  );
}
