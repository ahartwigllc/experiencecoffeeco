import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/*
 * All money is stored as integer cents (USD). All timestamps are timestamptz.
 * Reporting buckets use APP_TIMEZONE (America/New_York) at query time.
 */

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const productStatus = pgEnum("product_status", ["active", "draft", "archived"]);
export const productKind = pgEnum("product_kind", ["beans", "cold_brew", "other"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "partially_refunded",
  "refunded",
  "cancelled",
]);
export const fulfillmentStatus = pgEnum("fulfillment_status", ["unfulfilled", "ready", "fulfilled"]);
export const fulfillmentMethod = pgEnum("fulfillment_method", ["delivery", "pickup", "shipping"]);
export const orderSource = pgEnum("order_source", ["web", "subscription", "manual", "shopify"]);
export const staffRole = pgEnum("staff_role", ["owner", "staff"]);
export const subscriberStatus = pgEnum("subscriber_status", [
  "pending",
  "subscribed",
  "unsubscribed",
  "bounced",
]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "sending", "sent"]);
export const expenseCategory = pgEnum("expense_category", [
  "green_coffee",
  "packaging",
  "ingredients",
  "equipment",
  "software",
  "marketing",
  "delivery",
  "rent",
  "fees",
  "other",
]);

/* ------------------------------------------------------------------ catalog */

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  title: text("title").notNull(),
  kind: productKind("kind").notNull().default("beans"),
  descriptionHtml: text("description_html").notNull().default(""),
  origin: text("origin"),
  process: text("process"),
  flavorNotes: text("flavor_notes"),
  cuppingScore: text("cupping_score"),
  status: productStatus("status").notNull().default("draft"),
  images: jsonb("images").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  /** Stripe Tax product tax code, only used when settings.taxMode = "stripe_tax". */
  taxCode: text("tax_code"),
  subscriptionEnabled: boolean("subscription_enabled").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  shopifyId: text("shopify_id").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    size: text("size"),
    grind: text("grind"),
    priceCents: integer("price_cents").notNull(),
    /** What one unit costs you to make (beans + bag + label). Drives COGS and profit. */
    unitCostCents: integer("unit_cost_cents"),
    sku: text("sku"),
    trackInventory: boolean("track_inventory").notNull().default(true),
    inventory: integer("inventory").notNull().default(0),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull().default(0),
    shopifyId: text("shopify_id").unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

/* ---------------------------------------------------------------- customers */

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  /** Always stored lower-case. Nullable because some Shopify customers only left a phone. */
  email: text("email").unique(),
  phone: text("phone"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  acceptsMarketing: boolean("accepts_marketing").notNull().default(false),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  note: text("note"),
  shopifyId: text("shopify_id").unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------- orders */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    /** Human order number. Continues from Shopify (#1001, #1002, ...). */
    number: integer("number").notNull().unique(),
    source: orderSource("source").notNull().default("web"),
    status: orderStatus("status").notNull().default("pending"),
    fulfillmentStatus: fulfillmentStatus("fulfillment_status").notNull().default("unfulfilled"),
    fulfillmentMethod: fulfillmentMethod("fulfillment_method").notNull().default("pickup"),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email"),
    phone: text("phone"),
    shipName: text("ship_name"),
    address1: text("address1"),
    address2: text("address2"),
    city: text("city"),
    state: text("state"),
    zip: text("zip"),
    country: text("country"),
    /** Sum of line prices before discounts. */
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    refundedCents: integer("refunded_cents").notNull().default(0),
    /** Payment processor fee. Null = not yet known (shows as "pending" in finance). */
    feeCents: integer("fee_cents"),
    paymentMethod: text("payment_method").notNull().default("stripe"),
    discountCodes: jsonb("discount_codes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeChargeId: text("stripe_charge_id"),
    stripeInvoiceId: text("stripe_invoice_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    shopifyId: text("shopify_id").unique(),
    note: text("note"),
    needsReview: boolean("needs_review").notNull().default(false),
    reviewReason: text("review_reason"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_pi_idx").on(t.stripePaymentIntentId),
    index("orders_charge_idx").on(t.stripeChargeId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    variantTitle: text("variant_title"),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    /** Line total after line-level discounts (order-level discounts live on the order). */
    totalCents: integer("total_cents").notNull(),
    /** Cost snapshot at time of sale, so later cost changes don't rewrite history. */
    unitCostCents: integer("unit_cost_cents"),
    subscriptionInterval: text("subscription_interval"),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/* ------------------------------------------------------------ subscriptions */

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  status: text("status").notNull(),
  interval: text("interval").notNull(),
  fulfillmentMethod: fulfillmentMethod("fulfillment_method").notNull().default("pickup"),
  shipName: text("ship_name"),
  address1: text("address1"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  paused: boolean("paused").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const subscriptionItems = pgTable("subscription_items", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  stripeSubscriptionItemId: text("stripe_subscription_item_id").unique(),
  variantId: integer("variant_id").references(() => variants.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
});

/* ------------------------------------------------------------------ coupons */

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  percentOff: integer("percent_off"),
  amountOffCents: integer("amount_off_cents"),
  /** once | forever | repeating — how long it applies to a subscription. */
  duration: text("duration").notNull().default("once"),
  durationInMonths: integer("duration_in_months"),
  maxRedemptions: integer("max_redemptions"),
  firstTimeOnly: boolean("first_time_only").notNull().default(false),
  minimumCents: integer("minimum_cents"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  stripeCouponId: text("stripe_coupon_id"),
  stripePromotionCodeId: text("stripe_promotion_code_id").unique(),
  timesRedeemed: integer("times_redeemed").notNull().default(0),
  shopifyId: text("shopify_id").unique(),
  createdAt: createdAt(),
});

/* ------------------------------------------------------ staff + time clock */

export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: staffRole("role").notNull().default("staff"),
  hourlyWageCents: integer("hourly_wage_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const timeEntries = pgTable(
  "time_entries",
  {
    id: serial("id").primaryKey(),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    clockIn: timestamp("clock_in", { withTimezone: true }).notNull(),
    clockOut: timestamp("clock_out", { withTimezone: true }),
    /** Wage snapshot so a raise doesn't change past labor cost. */
    hourlyWageCents: integer("hourly_wage_cents").notNull().default(0),
    note: text("note"),
    editedById: integer("edited_by_id").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("time_entries_staff_idx").on(t.staffId), index("time_entries_in_idx").on(t.clockIn)],
);

/* ----------------------------------------------------------------- expenses */

export const expenses = pgTable(
  "expenses",
  {
    id: serial("id").primaryKey(),
    spentOn: date("spent_on").notNull(),
    category: expenseCategory("category").notNull().default("other"),
    vendor: text("vendor"),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdById: integer("created_by_id").references(() => staff.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_spent_idx").on(t.spentOn)],
);

/* ---------------------------------------------------------------- marketing */

export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  status: subscriberStatus("status").notNull().default("pending"),
  source: text("source").notNull().default("website"),
  confirmTokenHash: text("confirm_token_hash"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  bodyMarkdown: text("body_markdown").notNull().default(""),
  status: campaignStatus("status").notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdById: integer("created_by_id").references(() => staff.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const campaignSends = pgTable(
  "campaign_sends",
  {
    id: serial("id").primaryKey(),
    campaignId: integer("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    subscriberId: integer("subscriber_id").references(() => subscribers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    providerId: text("provider_id"),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("campaign_sends_campaign_idx").on(t.campaignId)],
);

/* ------------------------------------------------------------------- system */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const magicLinks = pgTable("magic_links", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/** Every processed Stripe webhook event, for idempotency. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  handled: boolean("handled").notNull().default(false),
  createdAt: createdAt(),
});

/* ---------------------------------------------------------------- relations */

export const productsRelations = relations(products, ({ many }) => ({ variants: many(variants) }));
export const variantsRelations = relations(variants, ({ one }) => ({
  product: one(products, { fields: [variants.productId], references: [products.id] }),
}));
export const customersRelations = relations(customers, ({ many }) => ({
  orders: many(orders),
  subscriptions: many(subscriptions),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(customers, { fields: [orders.customerId], references: [customers.id] }),
  items: many(orderItems),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  variant: one(variants, { fields: [orderItems.variantId], references: [variants.id] }),
}));
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  customer: one(customers, { fields: [subscriptions.customerId], references: [customers.id] }),
  items: many(subscriptionItems),
}));
export const subscriptionItemsRelations = relations(subscriptionItems, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionItems.subscriptionId],
    references: [subscriptions.id],
  }),
}));
export const staffRelations = relations(staff, ({ many }) => ({ timeEntries: many(timeEntries) }));
export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  staff: one(staff, { fields: [timeEntries.staffId], references: [staff.id] }),
}));
export const campaignsRelations = relations(campaigns, ({ many }) => ({ sends: many(campaignSends) }));
export const campaignSendsRelations = relations(campaignSends, ({ one }) => ({
  campaign: one(campaigns, { fields: [campaignSends.campaignId], references: [campaigns.id] }),
}));

export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Staff = typeof staff.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Subscriber = typeof subscribers.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
