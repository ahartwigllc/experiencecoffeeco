import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDescription } from "../src/lib/shopify-parse";

const snap = JSON.parse(readFileSync("migration/data/products.snapshot.json", "utf8")) as {
  products: { title: string; descriptionHtml: string }[];
};
const byTitle = (t: string) => snap.products.find((p) => p.title.includes(t))!;

test("Peru lot parses notes, process, score, origin", () => {
  const p = byTitle("Peru");
  const r = parseDescription(p.title, p.descriptionHtml);
  assert.equal(r.flavorNotes, "Strawberry wine, lime, gummy candy");
  assert.equal(r.process, "Natural");
  assert.equal(r.cuppingScore, "87.5");
  assert.equal(r.origin, "Peru");
  assert.ok(!/Flavor/i.test(r.descriptionHtml));
  assert.ok(r.descriptionHtml.includes("Agua Colorada"));
});

test("Guji parses and drops empty paragraphs", () => {
  const p = byTitle("Guji");
  const r = parseDescription(p.title, p.descriptionHtml);
  assert.equal(r.flavorNotes, "Herbal tea, dried lemon, and tropical fruit");
  assert.equal(r.cuppingScore, "85");
  assert.equal(r.process, "Natural");
  assert.equal(r.origin, "Ethiopia");
  assert.ok(!r.descriptionHtml.includes("<p> </p>"));
});

test("Wush Wush takes process from the title", () => {
  const p = byTitle("Wush");
  const r = parseDescription(p.title, p.descriptionHtml);
  assert.equal(r.process, "Anaerobic Natural");
  assert.equal(r.flavorNotes, "Strawberry, banana, blackberry, lemonade and sugar cane");
  assert.equal(r.cuppingScore, null);
});

test("Cold brew has no structured fields", () => {
  const p = byTitle("Cold Brew");
  const r = parseDescription(p.title, p.descriptionHtml);
  assert.equal(r.flavorNotes, null);
  assert.ok(r.descriptionHtml.startsWith("<p>Our signature"));
});
