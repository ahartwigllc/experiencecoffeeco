import { test } from "node:test";
import assert from "node:assert/strict";
import { funkiness } from "../src/lib/flavor-scale";

test("washed coffees sit at the clean end", () => {
  assert.ok((funkiness("Washed") ?? 100) < 30);
});

test("naturals sit past the middle, anaerobic naturals at the funky end", () => {
  const natural = funkiness("Natural")!;
  const anaerobic = funkiness("Anaerobic Natural")!;
  assert.ok(natural > 50 && natural < anaerobic);
  assert.ok(anaerobic >= 90);
});

test("process can come from the title when the field is empty", () => {
  assert.equal(funkiness(null, "Ethiopian Guji (Natural Process)"), 66);
});

test("no process information gives no scale", () => {
  assert.equal(funkiness(null, "Cold Brew Box (67oz)"), null);
});
