-- "More info" story, grade wording, and a manual clean/funky position per product.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "more_info_html" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "grade_label" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "funk_level" integer;
