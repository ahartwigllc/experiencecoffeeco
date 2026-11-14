import assert from "node:assert/strict";
import { test } from "node:test";
import { formatBillingDay, nextBillingDay } from "../src/lib/billing-day";

const iso = (d: Date) => d.toISOString();

test("Friday evening -> next Wednesday 9am New York (EST, UTC-5)", () => {
  assert.equal(iso(nextBillingDay(new Date("2026-11-13T23:00:00Z"))), "2026-11-18T14:00:00.000Z");
});

test("Wednesday before 9am -> same day", () => {
  assert.equal(iso(nextBillingDay(new Date("2026-11-18T12:30:00Z"))), "2026-11-18T14:00:00.000Z");
});

test("Wednesday after 9am -> following Wednesday, under 7 days away", () => {
  const now = new Date("2026-11-18T15:00:00Z");
  const d = nextBillingDay(now);
  assert.equal(iso(d), "2026-11-25T14:00:00.000Z");
  assert.ok(d.getTime() - now.getTime() < 7 * 86400000);
});

test("summer time (EDT, UTC-4)", () => {
  assert.equal(iso(nextBillingDay(new Date("2026-07-06T12:00:00Z"))), "2026-07-08T13:00:00.000Z");
});

test("label", () => {
  assert.equal(formatBillingDay(new Date("2026-11-18T14:00:00Z")), "Wednesday, Nov 18");
});
