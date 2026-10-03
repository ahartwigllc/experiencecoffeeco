import { test } from "node:test";
import assert from "node:assert/strict";
import {
  intervalFromShopifyPlan,
  intervalFromStripe,
  isDeliveryZip,
  monthlyValueCents,
  subscriptionUnitPrice,
  validateCartShape,
} from "../src/lib/pricing";

test("subscription discount matches Shopify history (20% off)", () => {
  assert.equal(subscriptionUnitPrice(2500, 20), 2000); // Cold Brew $25 -> $20
  assert.equal(subscriptionUnitPrice(1000, 20), 800); // 8oz $10 -> $8
  assert.equal(subscriptionUnitPrice(1600, 20), 1280);
  assert.equal(subscriptionUnitPrice(1600, 0), 1600);
  assert.equal(subscriptionUnitPrice(1600, 500), 160); // clamps to 90%
});

test("Shopify selling plan names map to intervals", () => {
  assert.equal(intervalFromShopifyPlan("Weekly subscription"), "week");
  assert.equal(intervalFromShopifyPlan("Bi-Weekly subscription"), "2week");
  assert.equal(intervalFromShopifyPlan("month subscription"), "month");
  assert.equal(intervalFromShopifyPlan(null), null);
});

test("Stripe recurring maps to intervals", () => {
  assert.equal(intervalFromStripe("week", 1), "week");
  assert.equal(intervalFromStripe("week", 2), "2week");
  assert.equal(intervalFromStripe("month", 1), "month");
  assert.equal(intervalFromStripe("year", 1), null);
});

test("cart validation", () => {
  assert.equal(validateCartShape([]).ok, false);
  assert.equal(validateCartShape([{ variantId: 1, quantity: 1, interval: null }]).ok, true);
  assert.equal(validateCartShape([{ variantId: 1, quantity: 0, interval: null }]).ok, false);
  assert.equal(validateCartShape([{ variantId: 1, quantity: 51, interval: null }]).ok, false);
  assert.equal(
    validateCartShape([
      { variantId: 1, quantity: 1, interval: "week" },
      { variantId: 2, quantity: 1, interval: "month" },
    ]).ok,
    false,
  );
  assert.equal(
    validateCartShape([
      { variantId: 1, quantity: 1, interval: "week" },
      { variantId: 2, quantity: 1, interval: null },
    ]).ok,
    true,
  );
});

test("delivery zip check", () => {
  assert.equal(isDeliveryZip("07071", ["07071"]), true);
  assert.equal(isDeliveryZip("07071-1234", ["07071"]), true);
  assert.equal(isDeliveryZip("10001", ["07071"]), false);
  assert.equal(isDeliveryZip("abc", ["07071"]), false);
});

test("MRR normalization", () => {
  assert.equal(monthlyValueCents(2000, 1, "month"), 2000);
  assert.equal(monthlyValueCents(2000, 1, "2week"), Math.round((2000 * 26) / 12));
  assert.equal(monthlyValueCents(2000, 1, "week"), Math.round((2000 * 52) / 12));
});
