import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSettings, type Settings } from "@/lib/settings";

/*
 * Starter policy text written for this business. The owner should review these
 * (and ideally have a lawyer look at Terms and Privacy) before launch.
 */
const POLICIES: Record<string, { title: string; body: (s: Settings) => string[] }> = {
  delivery: {
    title: "Delivery and pickup",
    body: (s) => [
      `Pickup is free at ${s.pickupAddress}. ${s.pickupInstructions}`,
      `Local delivery is available to these ZIP codes: ${s.deliveryZips.join(", ")}. ${s.deliveryNote}`,
      s.shippingEnabled
        ? "We also ship within the US. Orders ship within two business days of roasting."
        : "We don't ship outside our local delivery area yet. Join the email list to hear when we do.",
      "Subscription orders are prepared on each renewal date and delivered or made ready for pickup the same way as your first order.",
    ],
  },
  refunds: {
    title: "Refunds",
    body: (s) => [
      "Coffee is food, so we can't take returns. If something is wrong with your order, such as a damaged box or the wrong grind, tell us within 7 days and we'll replace it or refund you.",
      `Email ${s.supportEmail} with your order number. Refunds go back to your original payment method and usually appear in 5 to 10 business days.`,
      "You can cancel a subscription at any time from your account. Cancelling stops future renewals; it doesn't refund orders that have already been prepared.",
    ],
  },
  privacy: {
    title: "Privacy",
    body: (s) => [
      `${s.businessName} collects the information you give us when you order or sign up for email: your name, email, phone, and delivery address. We use it to fulfil orders, send receipts and order updates, and, if you opt in, send news about our coffee.`,
      "Payments are processed by Stripe. We never see or store your full card number. Emails are sent through Resend. We don't sell or rent your information to anyone.",
      "Every marketing email has an unsubscribe link. To see, correct, or delete the information we hold about you, email " + s.supportEmail + ".",
      "This site uses essential cookies only: one to keep your cart and one to keep you signed in. No advertising trackers.",
    ],
  },
  terms: {
    title: "Terms",
    body: (s) => [
      `These terms cover purchases from ${s.businessName}. Prices are in US dollars. We may change prices or stop selling a coffee at any time, but we honour the price you paid for an order already placed.`,
      "Subscriptions renew automatically at the schedule you choose until you cancel. You can skip, pause, or cancel from your account before your next renewal date.",
      "Specialty lots are limited. If we can't fill an order, we'll offer a substitute or a full refund.",
      `Questions? Email ${s.supportEmail}.`,
    ],
  },
};

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  return { title: POLICIES[slug]?.title ?? "Policy" };
}

export default async function PolicyPage({ params }: Params) {
  const { slug } = await params;
  const policy = POLICIES[slug];
  if (!policy) notFound();
  const s = await getSettings();
  return (
    <div className="wrap narrow">
      <div className="page-head">
        <h1>{policy.title}</h1>
      </div>
      <div className="prose">
        {policy.body(s).map((p) => (
          <p key={p.slice(0, 40)}>{p}</p>
        ))}
      </div>
    </div>
  );
}
