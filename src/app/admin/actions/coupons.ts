"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { publishCouponToStripe } from "@/lib/coupons";
import { parseLocalDateTime } from "@/lib/dates";
import { flash } from "@/lib/flash";
import { parseDollarsToCents } from "@/lib/money";
import { isStripeConfigured, stripe } from "@/lib/stripe";
import { syncCouponRedemptions } from "@/lib/stripe-sync";

const PAGE = "/admin/coupons";

export async function createCoupon(formData: FormData) {
  await requireOwner();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  if (code.length < 3) flash(PAGE, "error", "Codes need at least 3 letters or numbers.");
  const type = String(formData.get("type"));
  const percent = Number(formData.get("percent"));
  const amount = parseDollarsToCents(formData.get("amount"));
  if (type === "percent" && !(percent >= 1 && percent <= 100)) flash(PAGE, "error", "Percent off must be between 1 and 100.");
  if (type === "amount" && !(amount && amount > 0)) flash(PAGE, "error", "Enter the dollar amount off.");
  const duration = String(formData.get("duration") ?? "once");
  const existing = await db().query.coupons.findFirst({ where: eq(schema.coupons.code, code) });
  if (existing) flash(PAGE, "error", `${code} already exists.`);

  const [row] = await db()
    .insert(schema.coupons)
    .values({
      code,
      description: String(formData.get("description") ?? "").trim() || null,
      percentOff: type === "percent" ? Math.round(percent) : null,
      amountOffCents: type === "amount" ? amount : null,
      duration: ["once", "forever", "repeating"].includes(duration) ? duration : "once",
      durationInMonths: duration === "repeating" ? Math.max(1, Number(formData.get("months")) || 1) : null,
      maxRedemptions: Number(formData.get("maxRedemptions")) || null,
      firstTimeOnly: formData.get("firstTimeOnly") === "on",
      minimumCents: parseDollarsToCents(formData.get("minimum")),
      expiresAt: parseLocalDateTime(String(formData.get("expiresAt") ?? "")),
    })
    .returning();

  if (isStripeConfigured()) {
    try {
      await publishCouponToStripe(row!);
    } catch (err) {
      flash(PAGE, "error", `Saved, but Stripe didn't accept it: ${err instanceof Error ? err.message : "unknown"}. Fix and press Publish.`);
    }
  }
  revalidatePath(PAGE);
  flash(PAGE, "ok", isStripeConfigured() ? `${code} is live at checkout.` : `${code} saved. It goes live once Stripe is connected and you press Publish.`);
}

export async function publishCoupon(formData: FormData) {
  await requireOwner();
  const c = await db().query.coupons.findFirst({ where: eq(schema.coupons.id, Number(formData.get("id"))) });
  if (!c) flash(PAGE, "error", "Coupon not found.");
  try {
    await publishCouponToStripe(c);
  } catch (err) {
    flash(PAGE, "error", `Stripe error: ${err instanceof Error ? err.message : "unknown"}`);
  }
  revalidatePath(PAGE);
  flash(PAGE, "ok", `${c.code} is live at checkout.`);
}

export async function toggleCoupon(formData: FormData) {
  await requireOwner();
  const c = await db().query.coupons.findFirst({ where: eq(schema.coupons.id, Number(formData.get("id"))) });
  if (!c) flash(PAGE, "error", "Coupon not found.");
  const active = !c.active;
  if (c.stripePromotionCodeId) {
    try {
      await stripe().promotionCodes.update(c.stripePromotionCodeId, { active });
    } catch (err) {
      flash(PAGE, "error", `Stripe error: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  await db().update(schema.coupons).set({ active }).where(eq(schema.coupons.id, c.id));
  revalidatePath(PAGE);
  flash(PAGE, "ok", active ? `${c.code} turned on.` : `${c.code} turned off.`);
}

export async function refreshCouponUsage() {
  await requireOwner();
  await syncCouponRedemptions();
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Usage refreshed from Stripe.");
}
