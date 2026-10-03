import { test } from "node:test";
import assert from "node:assert/strict";
import { markdownToHtml, markdownToText } from "../src/lib/markdown";
import { createSignedToken, hashPassword, readSignedToken, verifyPassword } from "../src/lib/crypto";
import { toCsv } from "../src/lib/csv";

test("markdown escapes HTML and renders basics", () => {
  const html = markdownToHtml("# New lot\n\nHello <script>x</script> **bold**\n\n- one\n- two\n\n[Shop](https://experiencecoffee.co/shop)");
  assert.ok(html.includes("<h2"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("<strong>bold</strong>"));
  assert.ok(html.includes("<ul><li>one</li><li>two</li></ul>"));
  assert.ok(html.includes('href="https://experiencecoffee.co/shop"'));
});

test("markdown blocks javascript: links", () => {
  const html = markdownToHtml("[x](javascript:alert(1))");
  assert.ok(!html.includes("href"));
});

test("markdown buttons", () => {
  const html = markdownToHtml("{{button: Shop now | https://experiencecoffee.co/shop}}");
  assert.ok(html.includes("Shop now"));
  assert.equal(markdownToText("{{button: Shop now | https://x.co}}"), "Shop now: https://x.co");
});

test("password hashing round-trips", async () => {
  const h = await hashPassword("correct horse battery staple");
  assert.ok(await verifyPassword("correct horse battery staple", h));
  assert.ok(!(await verifyPassword("wrong", h)));
});

test("signed tokens verify, reject tampering and expiry", async () => {
  const secret = "x".repeat(40);
  const t = await createSignedToken({ sid: 7 }, secret, 60);
  assert.equal((await readSignedToken<{ sid: number }>(t, secret))?.sid, 7);
  assert.equal(await readSignedToken(t + "a", secret), null);
  assert.equal(await readSignedToken(t, "y".repeat(40)), null);
  const expired = await createSignedToken({ sid: 7 }, secret, -10);
  assert.equal(await readSignedToken(expired, secret), null);
});

test("csv escaping and formula protection", () => {
  const csv = toCsv(["a", "b"], [["x,y", "=SUM(A1)"], [-5, 'q"t']]);
  assert.equal(csv, 'a,b\r\n"x,y",\'=SUM(A1)\r\n-5,"q""t"\r\n');
});
