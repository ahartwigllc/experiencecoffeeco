-- Options that keep their one-time price for subscribers (5lb bags).
ALTER TABLE "variants" ADD COLUMN IF NOT EXISTS "no_subscription_discount" boolean DEFAULT false NOT NULL;
UPDATE "variants" SET "no_subscription_discount" = true WHERE lower("size") IN ('5lb', '5 lb', '5lbs', '5 lbs');
-- 48-hour renewal reminders.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "reminder_sent_for" timestamp with time zone;
