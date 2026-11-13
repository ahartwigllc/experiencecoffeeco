import assert from "node:assert/strict";
import { test } from "node:test";
import { gradeBand, gradePosition, parseScore } from "../src/lib/grade.ts";

test("parses cupping scores", () => {
  assert.equal(parseScore("87.50"), 87.5);
  assert.equal(parseScore("SCA 86+"), 86);
  assert.equal(parseScore(""), null);
  assert.equal(parseScore(null), null);
});

test("bands", () => {
  assert.equal(gradeBand(84.99)?.label, "Very good");
  assert.equal(gradeBand(85)?.label, "Excellent");
  assert.equal(gradeBand(88.5)?.label, "Excellent");
  assert.equal(gradeBand(90)?.label, "Outstanding");
  assert.equal(gradeBand(100)?.label, "Outstanding");
  assert.equal(gradeBand(79), null);
});

test("bar position on the 80-100 range", () => {
  assert.equal(gradePosition(80), 0);
  assert.equal(gradePosition(88.5), 42.5);
  assert.equal(gradePosition(100), 100);
  assert.equal(gradePosition(70), 0);
});
