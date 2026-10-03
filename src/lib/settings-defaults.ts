import type { Interval } from "./pricing";

/**
 * Store-wide settings, editable in Admin > Settings. Defaults mirror how the
 * Shopify store was actually operating (see docs/BUILD_LOG.md, "Assumptions & Decisions").
 */
export const DEFAULT_SETTINGS = {
  businessName: "Experience Coffee",
  supportEmail: "ahartwigllc@gmail.com",
  ownerNotifyEmail: "ahartwigllc@gmail.com",
  phone: "(717) 612-8069",
  /** Required in marketing email footers (CAN-SPAM). A PO box is allowed. */
  businessPostalAddress: "523 Anthony Court, Unit 2, Lyndhurst, NJ 07071",
  announcement: "",
  instagramUrl: "",
  tiktokUrl: "",

  subscriptionDiscountPercent: 20,
  subscriptionIntervals: ["week", "2week", "month"] as Interval[],

  pickupEnabled: true,
  pickupAddress: "523 Anthony Court, Unit 2, Lyndhurst, NJ 07071",
  pickupInstructions: "Usually ready within 24 hours. We'll email you when your order is ready.",

  deliveryEnabled: true,
  deliveryFeeCents: 0,
  deliveryMinimumCents: 0,
  deliveryZips: ["07071", "07070", "07072", "07073", "07110", "07512", "07031", "07111", "07032", "07012"],
  deliveryNote: "Free local delivery, usually within a day or two of your order.",

  shippingEnabled: false,
  shippingFlatCents: 800,
  freeShippingOverCents: 5000,

  /** "none" matches Shopify history ($0 tax collected). "stripe_tax" turns on Stripe Tax. */
  taxMode: "none" as "none" | "stripe_tax",
  /** Share of positive net profit to set aside for income tax (an estimate shown on Finance). */
  incomeTaxReservePercent: 25,
  /**
   * unit_cost: COGS = items sold x unit cost entered on each variant.
   * purchases: COGS = expenses in green coffee / packaging / ingredients categories.
   */
  cogsMethod: "unit_cost" as "unit_cost" | "purchases",
  lowInventoryThreshold: 5,
  /** email -> ISO date we invited a former Shopify subscriber to re-subscribe here. */
  legacyInvitesSent: {} as Record<string, string>,
};

export type Settings = typeof DEFAULT_SETTINGS;
