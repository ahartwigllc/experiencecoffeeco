import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Coupon } from "@/db/schema";
import { stripe } from "./stripe";

/**
 * Creates the Stripe coupon + customer-facing promotion code for a coupon row
 * and stores the Stripe ids. Safe to call again: it skips work already done.
 */
export async function publishCouponToStripe(c: Coupon): Promise<void> {
  let couponId = c.stripeCouponId;
  if (!couponId) {
    const created = await stripe().coupons.create({
      name: c.code,
      ...(c.percentOff ? { percent_off: c.percentOff } : { amount_off: c.amountOffCents ?? 0, currency: "usd" }),
      duration: c.duration as "once" | "forever" | "repeating",
      ...(c.duration === "repeating" ? { duration_in_months: c.durationInMonths ?? 1 } : {}),
      metadata: { couponId: String(c.id) },
    });
    couponId = created.id;
    await db().update(schema.coupons).set({ stripeCouponId: couponId }).where(eq(schema.coupons.id, c.id));
  }
  if (!c.stripePromotionCodeId) {
    const promo = await stripe().promotionCodes.create({
      coupon: couponId,
      code: c.code,
      active: c.active,
      ...(c.maxRedemptions ? { max_redemptions: c.maxRedemptions } : {}),
      ...(c.expiresAt ? { expires_at: Math.floor(c.expiresAt.getTime() / 1000) } : {}),
      restrictions: {
        first_time_transaction: c.firstTimeOnly,
        ...(c.minimumCents ? { minimum_amount: c.minimumCents, minimum_amount_currency: "usd" } : {}),
      },
      metadata: { couponId: String(c.id) },
    });
    await db().update(schema.coupons).set({ stripePromotionCodeId: promo.id }).where(eq(schema.coupons.id, c.id));
  }
}
