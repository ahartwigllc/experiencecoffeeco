import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { ClearCart } from "@/components/CartLink";
import { db, schema } from "@/db/client";
import { getSettings } from "@/lib/settings";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const settings = await getSettings();
  let email: string | null = null;
  let method: string | null = null;
  let orderNumber: number | null = null;

  if (session_id && /^cs_[A-Za-z0-9_]+$/.test(session_id)) {
    try {
      const s = await stripe().checkout.sessions.retrieve(session_id);
      email = s.customer_details?.email ?? null;
      method = s.metadata?.fulfillment ?? null;
      const o = await db().query.orders.findFirst({ where: eq(schema.orders.stripeCheckoutSessionId, session_id) });
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
      <p className="lede">
        {email ? `A receipt is on its way to ${email}. ` : "A receipt is on its way to your inbox. "}
        {method === "pickup"
          ? `We'll email you when it's ready to pick up at ${settings.pickupAddress}.`
          : method === "delivery"
            ? "We'll bring it to you within a day or two and email you when it's on the way."
            : "We'll email you when it ships."}
      </p>
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
