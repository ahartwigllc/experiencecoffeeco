CREATE TYPE "public"."product_status" AS ENUM('active','draft','archived');
CREATE TYPE "public"."product_kind" AS ENUM('beans','cold_brew','other');
CREATE TYPE "public"."order_status" AS ENUM('pending','paid','partially_refunded','refunded','cancelled');
CREATE TYPE "public"."fulfillment_status" AS ENUM('unfulfilled','ready','fulfilled');
CREATE TYPE "public"."fulfillment_method" AS ENUM('delivery','pickup','shipping');
CREATE TYPE "public"."order_source" AS ENUM('web','subscription','manual','shopify');
CREATE TYPE "public"."staff_role" AS ENUM('owner','staff');
CREATE TYPE "public"."subscriber_status" AS ENUM('pending','subscribed','unsubscribed','bounced');
CREATE TYPE "public"."campaign_status" AS ENUM('draft','sending','sent');
CREATE TYPE "public"."expense_category" AS ENUM('green_coffee','packaging','ingredients','equipment','software','marketing','delivery','rent','fees','other');

CREATE TABLE "products" (
 "id" serial PRIMARY KEY NOT NULL, "handle" text NOT NULL, "title" text NOT NULL,
 "kind" "product_kind" DEFAULT 'beans' NOT NULL, "description_html" text DEFAULT '' NOT NULL,
 "origin" text, "process" text, "flavor_notes" text, "cupping_score" text,
 "status" "product_status" DEFAULT 'draft' NOT NULL, "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "tax_code" text, "subscription_enabled" boolean DEFAULT true NOT NULL, "featured" boolean DEFAULT false NOT NULL,
 "sort_order" integer DEFAULT 0 NOT NULL, "shopify_id" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "products_handle_unique" UNIQUE("handle"), CONSTRAINT "products_shopify_id_unique" UNIQUE("shopify_id"));

CREATE TABLE "variants" (
 "id" serial PRIMARY KEY NOT NULL, "product_id" integer NOT NULL, "title" text NOT NULL, "size" text, "grind" text,
 "price_cents" integer NOT NULL, "unit_cost_cents" integer, "sku" text,
 "track_inventory" boolean DEFAULT true NOT NULL, "inventory" integer DEFAULT 0 NOT NULL, "active" boolean DEFAULT true NOT NULL,
 "position" integer DEFAULT 0 NOT NULL, "shopify_id" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "variants_shopify_id_unique" UNIQUE("shopify_id"));

CREATE TABLE "customers" (
 "id" serial PRIMARY KEY NOT NULL, "email" text, "phone" text, "first_name" text, "last_name" text,
 "stripe_customer_id" text, "accepts_marketing" boolean DEFAULT false NOT NULL,
 "address1" text, "address2" text, "city" text, "state" text, "zip" text, "note" text, "shopify_id" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "customers_email_unique" UNIQUE("email"), CONSTRAINT "customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
 CONSTRAINT "customers_shopify_id_unique" UNIQUE("shopify_id"));

CREATE TABLE "orders" (
 "id" serial PRIMARY KEY NOT NULL, "number" integer NOT NULL,
 "source" "order_source" DEFAULT 'web' NOT NULL, "status" "order_status" DEFAULT 'pending' NOT NULL,
 "fulfillment_status" "fulfillment_status" DEFAULT 'unfulfilled' NOT NULL, "fulfillment_method" "fulfillment_method" DEFAULT 'pickup' NOT NULL,
 "customer_id" integer, "email" text, "phone" text, "ship_name" text, "address1" text, "address2" text, "city" text, "state" text, "zip" text, "country" text,
 "subtotal_cents" integer DEFAULT 0 NOT NULL, "discount_cents" integer DEFAULT 0 NOT NULL, "shipping_cents" integer DEFAULT 0 NOT NULL,
 "tax_cents" integer DEFAULT 0 NOT NULL, "total_cents" integer DEFAULT 0 NOT NULL, "refunded_cents" integer DEFAULT 0 NOT NULL,
 "fee_cents" integer, "payment_method" text DEFAULT 'stripe' NOT NULL, "discount_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
 "stripe_checkout_session_id" text, "stripe_payment_intent_id" text, "stripe_charge_id" text, "stripe_invoice_id" text, "stripe_subscription_id" text,
 "shopify_id" text, "note" text, "needs_review" boolean DEFAULT false NOT NULL, "review_reason" text,
 "ready_at" timestamp with time zone, "fulfilled_at" timestamp with time zone,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "orders_number_unique" UNIQUE("number"), CONSTRAINT "orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
 CONSTRAINT "orders_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id"), CONSTRAINT "orders_shopify_id_unique" UNIQUE("shopify_id"));

CREATE TABLE "order_items" (
 "id" serial PRIMARY KEY NOT NULL, "order_id" integer NOT NULL, "product_id" integer, "variant_id" integer,
 "title" text NOT NULL, "variant_title" text, "quantity" integer NOT NULL, "unit_price_cents" integer NOT NULL,
 "total_cents" integer NOT NULL, "unit_cost_cents" integer, "subscription_interval" text);

CREATE TABLE "subscriptions" (
 "id" serial PRIMARY KEY NOT NULL, "stripe_subscription_id" text NOT NULL, "customer_id" integer, "status" text NOT NULL, "interval" text NOT NULL,
 "fulfillment_method" "fulfillment_method" DEFAULT 'pickup' NOT NULL, "ship_name" text, "address1" text, "address2" text, "city" text, "state" text, "zip" text,
 "current_period_end" timestamp with time zone, "cancel_at_period_end" boolean DEFAULT false NOT NULL, "paused" boolean DEFAULT false NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"));

CREATE TABLE "subscription_items" (
 "id" serial PRIMARY KEY NOT NULL, "subscription_id" integer NOT NULL, "stripe_subscription_item_id" text, "variant_id" integer,
 "title" text NOT NULL, "quantity" integer NOT NULL, "unit_price_cents" integer NOT NULL,
 CONSTRAINT "subscription_items_stripe_subscription_item_id_unique" UNIQUE("stripe_subscription_item_id"));

CREATE TABLE "coupons" (
 "id" serial PRIMARY KEY NOT NULL, "code" text NOT NULL, "description" text, "percent_off" integer, "amount_off_cents" integer,
 "duration" text DEFAULT 'once' NOT NULL, "duration_in_months" integer, "max_redemptions" integer, "first_time_only" boolean DEFAULT false NOT NULL,
 "minimum_cents" integer, "expires_at" timestamp with time zone, "active" boolean DEFAULT true NOT NULL,
 "stripe_coupon_id" text, "stripe_promotion_code_id" text, "times_redeemed" integer DEFAULT 0 NOT NULL, "shopify_id" text,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "coupons_code_unique" UNIQUE("code"), CONSTRAINT "coupons_stripe_promotion_code_id_unique" UNIQUE("stripe_promotion_code_id"),
 CONSTRAINT "coupons_shopify_id_unique" UNIQUE("shopify_id"));

CREATE TABLE "staff" (
 "id" serial PRIMARY KEY NOT NULL, "email" text NOT NULL, "name" text NOT NULL, "password_hash" text NOT NULL,
 "role" "staff_role" DEFAULT 'staff' NOT NULL, "hourly_wage_cents" integer DEFAULT 0 NOT NULL, "active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT "staff_email_unique" UNIQUE("email"));

CREATE TABLE "time_entries" (
 "id" serial PRIMARY KEY NOT NULL, "staff_id" integer NOT NULL, "clock_in" timestamp with time zone NOT NULL, "clock_out" timestamp with time zone,
 "hourly_wage_cents" integer DEFAULT 0 NOT NULL, "note" text, "edited_by_id" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "expenses" (
 "id" serial PRIMARY KEY NOT NULL, "spent_on" date NOT NULL, "category" "expense_category" DEFAULT 'other' NOT NULL,
 "vendor" text, "description" text NOT NULL, "amount_cents" integer NOT NULL, "created_by_id" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "subscribers" (
 "id" serial PRIMARY KEY NOT NULL, "email" text NOT NULL, "status" "subscriber_status" DEFAULT 'pending' NOT NULL,
 "source" text DEFAULT 'website' NOT NULL, "confirm_token_hash" text, "confirmed_at" timestamp with time zone,
 "unsubscribed_at" timestamp with time zone, "customer_id" integer, "created_at" timestamp with time zone DEFAULT now() NOT NULL,
 CONSTRAINT "subscribers_email_unique" UNIQUE("email"));

CREATE TABLE "campaigns" (
 "id" serial PRIMARY KEY NOT NULL, "subject" text NOT NULL, "preview_text" text, "body_markdown" text DEFAULT '' NOT NULL,
 "status" "campaign_status" DEFAULT 'draft' NOT NULL, "recipient_count" integer DEFAULT 0 NOT NULL, "failed_count" integer DEFAULT 0 NOT NULL,
 "sent_at" timestamp with time zone, "created_by_id" integer,
 "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "campaign_sends" (
 "id" serial PRIMARY KEY NOT NULL, "campaign_id" integer NOT NULL, "subscriber_id" integer, "email" text NOT NULL,
 "provider_id" text, "status" text NOT NULL, "error" text, "created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "settings" ("key" text PRIMARY KEY NOT NULL, "value" jsonb NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "magic_links" ("token_hash" text PRIMARY KEY NOT NULL, "email" text NOT NULL, "expires_at" timestamp with time zone NOT NULL,
 "used_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "stripe_events" ("id" text PRIMARY KEY NOT NULL, "type" text NOT NULL, "processed_at" timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE "contact_messages" ("id" serial PRIMARY KEY NOT NULL, "name" text NOT NULL, "email" text NOT NULL, "message" text NOT NULL,
 "handled" boolean DEFAULT false NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);

ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_edited_by_id_staff_id_fk" FOREIGN KEY ("edited_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_staff_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_staff_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "campaign_sends" ADD CONSTRAINT "campaign_sends_subscriber_id_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."subscribers"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
CREATE INDEX "orders_pi_idx" ON "orders" USING btree ("stripe_payment_intent_id");
CREATE INDEX "orders_charge_idx" ON "orders" USING btree ("stripe_charge_id");
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");
CREATE INDEX "time_entries_staff_idx" ON "time_entries" USING btree ("staff_id");
CREATE INDEX "time_entries_in_idx" ON "time_entries" USING btree ("clock_in");
CREATE INDEX "expenses_spent_idx" ON "expenses" USING btree ("spent_on");
CREATE INDEX "campaign_sends_campaign_idx" ON "campaign_sends" USING btree ("campaign_id");
