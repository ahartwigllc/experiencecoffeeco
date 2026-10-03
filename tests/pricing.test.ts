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

import {
  applySubscriptionDiscount,
  resolveSubscriptionDiscount,
  subscriptionDiscountLabel,
} from "../src/lib/pricing";

test("products without their own discount use the store default", () => {
  const d = resolveSubscriptionDiscount({ subscriptionDiscountType: "default", subscriptionDiscountValue: null }, 20);
  assert.deepEqual(d, { kind: "percent", percent: 20 });
  assert.equal(applySubscriptionDiscount(2500, d), 2000);
  assert.equal(subscriptionDiscountLabel(d), "Save 20%");
});

test("a product can set its own percentage", () => {
  const d = resolveSubscriptionDiscount({ subscriptionDiscountType: "percent", subscriptionDiscountValue: 15 }, 20);
  assert.equal(applySubscriptionDiscount(2100, d), 1785);
  assert.equal(subscriptionDiscountLabel(d), "Save 15%");
});

test("a product can take a fixed dollar amount off each unit", () => {
  const d = resolveSubscriptionDiscount({ subscriptionDiscountType: "amount", subscriptionDiscountValue: 300 }, 20);
  assert.equal(applySubscriptionDiscount(2500, d), 2200);
  assert.equal(subscriptionDiscountLabel(d), "Save $3.00");
});

test("a fixed discount never takes the price below 10% or 50 cents", () => {
  const d = { kind: "amount" as const, cents: 10_000 };
  assert.equal(applySubscriptionDiscount(2500, d), 250);
  assert.equal(applySubscriptionDiscount(300, d), 50);
  assert.equal(applySubscriptionDiscount(40, d), 40);
});

test("a type without a value falls back to the store default", () => {
  assert.deepEqual(resolveSubscriptionDiscount({ subscriptionDiscountType: "amount", subscriptionDiscountValue: null }, 20), {
    kind: "percent",
    percent: 20,
  });
});

test("zero discount shows no savings label", () => {
  assert.equal(subscriptionDiscountLabel({ kind: "percent", percent: 0 }), "");
  assert.equal(subscriptionDiscountLabel({ kind: "amount", cents: 0 }), "");
});
