-- Stock is green coffee per product (roast and grind to order), not a count per variant.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "green_stock_grams" integer;
-- Coffee variants no longer carry their own stock.
UPDATE "variants" SET "track_inventory" = false
  WHERE "product_id" IN (SELECT "id" FROM "products" WHERE "kind" = 'beans');
