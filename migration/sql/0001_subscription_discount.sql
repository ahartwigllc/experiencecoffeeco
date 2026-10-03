-- Per-product subscription discount (Admin > Products).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "subscription_discount_type" text DEFAULT 'default' NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "subscription_discount_value" integer;
