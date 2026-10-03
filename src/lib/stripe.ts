import Stripe from "stripe";
import { requireEnv } from "./env";

/**
 * API version is pinned so field shapes (invoice.charge, subscription.current_period_end,
 * promotionCodes.create({ coupon })) stay stable. Upgrade deliberately, not by accident.
 */
export const STRIPE_API_VERSION = "2024-06-20" as const;

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: STRIPE_API_VERSION,
      httpClient: Stripe.createFetchHttpClient(),
      appInfo: { name: "experience-coffee" },
    });
  }
  return client;
}

export const stripeCrypto = Stripe.createSubtleCryptoProvider();

export function stripeDashboardUrl(path: string): string {
  const test = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test");
  return `https://dashboard.stripe.com${test ? "/test" : ""}/${path.replace(/^\//, "")}`;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
