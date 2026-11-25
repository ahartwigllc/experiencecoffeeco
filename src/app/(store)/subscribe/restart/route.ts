import { NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { eq } from "drizzle-orm";
import { nextBillingDay } from "@/lib/billing-day";
import { CheckoutError, createCheckoutSession } from "@/lib/checkout";
import { siteUrl } from "@/lib/env";
import { legacyInterval, listLegacySubscribers, readRestartToken } from "@/lib/legacy-subscribers";
import { isDeliveryZip, INTERVALS } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const PERIOD_MS: Record<string, number> = { week: 7 * 86400_000, "2week": 14 * 86400_000, month: 28 * 86400_000 };

/**
 * One-click restart for a former Shopify subscriber: builds a Stripe Checkout for the same coffee,
 * schedule and current subscriber price, starting when their next Shopify charge would have been,
 * so they only confirm their card. Falls back to the product page if anything doesn't line up.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = await readRestartToken(url.searchParams.get("t"));
  if (!email) return NextResponse.redirect(`${siteUrl()}/shop?restart=expired`);

  const legacy = (await listLegacySubscribers()).find((l) => l.email === email);
  if (!legacy) return NextResponse.redirect(`${siteUrl()}/account`); // already moved
  const interval = legacyInterval(legacy);
  const product = legacy.productId ? await db().query.products.findFirst({ where: eq(schema.products.id, legacy.productId) }) : null;
  const fallback = product ? `${siteUrl()}/products/${product.handle}?subscribe=${interval}` : `${siteUrl()}/shop`;
  if (!legacy.variantId || !product) return NextResponse.redirect(fallback);

  const settings = await getSettings();
  const canDeliver = settings.deliveryEnabled && isDeliveryZip(legacy.zip, settings.deliveryZips);
  const fulfillment =
    legacy.fulfillment === "delivery" && canDeliver
      ? "delivery"
      : settings.pickupEnabled
        ? "pickup"
        : canDeliver
          ? "delivery"
          : null;
  if (!fulfillment) return NextResponse.redirect(fallback);

  // Start billing when Shopify would have charged them next (never more than one period out).
  const now = Date.now();
  const period = PERIOD_MS[interval] ?? PERIOD_MS.month!;
  const due = legacy.nextDue.getTime();
  let firstCharge: Date | undefined;
  if (product.kind === "cold_brew") {
    const wed = nextBillingDay(new Date(Math.max(now, due - 12 * 3600_000)));
    firstCharge = wed.getTime() - now < period ? wed : nextBillingDay();
  } else if (due > now + 3600_000 && due < now + period) {
    firstCharge = new Date(due);
  }

  try {
    const checkoutUrl = await createCheckoutSession(
      {
        lines: [{ variantId: legacy.variantId, quantity: legacy.quantity, interval }],
        fulfillment,
        deliveryZip: fulfillment === "delivery" ? legacy.zip : null,
      },
      { email, firstCharge, legacy: true, note: `Same coffee, ${INTERVALS[interval].short}, at your subscriber price.` },
    );
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (err) {
    if (!(err instanceof CheckoutError)) console.error("restart checkout failed", email, err);
    return NextResponse.redirect(fallback);
  }
}
