import { test } from "node:test";
import assert from "node:assert/strict";
import { monthKeysBetween, parseLocalDateTime, rangeBounds, toLocalInputValue, zonedMidnight } from "../src/lib/dates";

const NY = "America/New_York";

test("zoned midnight handles EDT and EST", () => {
  assert.equal(zonedMidnight(2026, 7, 1, NY).toISOString(), "2026-07-01T04:00:00.000Z");
  assert.equal(zonedMidnight(2026, 1, 1, NY).toISOString(), "2026-01-01T05:00:00.000Z");
  assert.equal(zonedMidnight(2026, 13, 1, NY).toISOString(), "2027-01-01T05:00:00.000Z");
});

test("this month bounds in New York", () => {
  const now = new Date("2026-10-02T03:00:00Z"); // still Oct 1 in NY
  const { start, end } = rangeBounds("month", now, NY);
  assert.equal(start.toISOString(), "2026-10-01T04:00:00.000Z");
  assert.equal(end.toISOString(), "2026-11-01T04:00:00.000Z");
  const today = rangeBounds("today", now, NY);
  assert.equal(today.start.toISOString(), "2026-10-01T04:00:00.000Z");
});

test("datetime-local round trip", () => {
  const d = parseLocalDateTime("2026-10-02T09:30", NY)!;
  assert.equal(d.toISOString(), "2026-10-02T13:30:00.000Z");
  assert.equal(toLocalInputValue(d, NY), "2026-10-02T09:30");
});

test("month keys", () => {
  const keys = monthKeysBetween(new Date("2026-02-10T12:00:00Z"), new Date("2026-05-01T04:00:00Z"), NY);
  assert.deepEqual(keys, ["2026-02", "2026-03", "2026-04"]);
});
