import { test } from "node:test";
import assert from "node:assert/strict";
import { computePnl, EMPTY_PNL_INPUT, estimateCardFeeCents, orderProfitCents } from "../src/lib/finance-math";

test("P&L math", () => {
  const p = computePnl({
    ...EMPTY_PNL_INPUT,
    orders: 10,
    grossCents: 30000,
    discountCents: 2000,
    refundedCents: 1000,
    shippingCents: 500,
    taxCents: 1800,
    feeCents: 900,
    cogsCents: 8000,
    laborCents: 6000,
    expensesCents: 2000,
    hoursWorked: 10,
    incomeTaxReservePercent: 25,
  });
  assert.equal(p.netSalesCents, 27000);
  assert.equal(p.revenueCents, 27500); // tax excluded
  assert.equal(p.grossProfitCents, 18600);
  assert.equal(p.netProfitCents, 10600);
  assert.equal(p.profitPerHourCents, 1060);
  assert.equal(p.averageOrderCents, 2750);
  assert.equal(p.incomeTaxReserveCents, 2650);
  assert.equal(p.takeHomeCents, 7950);
});

test("no hours and losses behave sensibly", () => {
  const p = computePnl({ ...EMPTY_PNL_INPUT, expensesCents: 5000, incomeTaxReservePercent: 25 });
  assert.equal(p.netProfitCents, -5000);
  assert.equal(p.profitPerHourCents, null);
  assert.equal(p.incomeTaxReserveCents, 0);
  assert.equal(p.netMargin, null);
});

test("order profit", () => {
  assert.equal(orderProfitCents({ totalCents: 2000, taxCents: 0, refundedCents: 0, feeCents: 88, cogsCents: 700 }), 1212);
  assert.equal(orderProfitCents({ totalCents: 2000, taxCents: 0, refundedCents: 0, feeCents: null, cogsCents: 0 }), 2000);
});

test("card fee estimate matches observed Shopify fees ($20 -> $0.88)", () => {
  assert.equal(estimateCardFeeCents(2000), 88);
  assert.equal(estimateCardFeeCents(0), 0);
});
