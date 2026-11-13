import { test } from "node:test";
import assert from "node:assert/strict";
import { applyBeanStock, greenGramsPerUnit, lbsToGrams, roastedLbsFromSize, unitsFromGreenStock } from "../src/lib/bean-stock";

test("size labels convert to roasted pounds", () => {
  assert.equal(roastedLbsFromSize("12oz"), 0.75);
  assert.equal(roastedLbsFromSize("8 oz"), 0.5);
  assert.equal(roastedLbsFromSize("2lb"), 2);
  assert.equal(roastedLbsFromSize("5 lbs"), 5);
  assert.equal(roastedLbsFromSize(null), null);
  assert.equal(roastedLbsFromSize("Default"), null);
});

test("15% roast loss: a 12oz bag uses 0.88 lb of green", () => {
  const g = greenGramsPerUnit("12oz")!;
  assert.ok(Math.abs(g / 453.59237 - 0.8824) < 0.001);
});

test("10 lb of green covers 11 x 12oz, 4 x 2lb, 1 x 5lb", () => {
  const green = lbsToGrams(10);
  assert.equal(unitsFromGreenStock(green, "12oz"), 11);
  assert.equal(unitsFromGreenStock(green, "2lb"), 4);
  assert.equal(unitsFromGreenStock(green, "5lb"), 1);
});

test("untracked products keep their variants as they are", () => {
  const vs = [{ size: "12oz", trackInventory: false, inventory: 0 }];
  assert.deepEqual(applyBeanStock({ greenStockGrams: null }, vs), vs);
});

test("tracked products derive every size and grind from the green stock", () => {
  const vs = [
    { size: "12oz", grind: "Fine", trackInventory: false, inventory: 0 },
    { size: "12oz", grind: "Whole Bean", trackInventory: true, inventory: 3 },
    { size: "2lb", grind: "Fine", trackInventory: false, inventory: 0 },
  ];
  const out = applyBeanStock({ greenStockGrams: lbsToGrams(3) }, vs);
  assert.deepEqual(out.map((v) => [v.trackInventory, v.inventory]), [[true, 3], [true, 3], [true, 1]]);
});

test("no green left means sold out", () => {
  const out = applyBeanStock({ greenStockGrams: 0 }, [{ size: "8oz", trackInventory: false, inventory: 9 }]);
  assert.equal(out[0]!.inventory, 0);
});
