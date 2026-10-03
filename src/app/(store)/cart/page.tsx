import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default async function CartPage() {
  const s = await getSettings();
  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Your cart</h1>
      </div>
      <CartView
        options={{
          pickupEnabled: s.pickupEnabled,
          pickupAddress: s.pickupAddress,
          pickupInstructions: s.pickupInstructions,
          deliveryEnabled: s.deliveryEnabled,
          deliveryZips: s.deliveryZips,
          deliveryFeeCents: s.deliveryFeeCents,
          deliveryMinimumCents: s.deliveryMinimumCents,
          deliveryNote: s.deliveryNote,
          shippingEnabled: s.shippingEnabled,
          shippingFlatCents: s.shippingFlatCents,
          freeShippingOverCents: s.freeShippingOverCents,
          intervals: s.subscriptionIntervals,
        }}
      />
    </div>
  );
}
