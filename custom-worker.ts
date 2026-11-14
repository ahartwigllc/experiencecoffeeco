/**
 * Cloudflare entry point: the OpenNext-generated app plus a daily cron that sends
 * "your card will be charged in two days" subscription reminders.
 * See https://opennext.js.org/cloudflare/howtos/custom-worker
 */
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";

type Env = Record<string, string | undefined>;
type Ctx = { waitUntil(p: Promise<unknown>): void };

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default {
  fetch: handler.fetch,
  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    const key = await sha256Hex(`cron:${env.STRIPE_WEBHOOK_SECRET ?? ""}`);
    const base = (env.SITE_URL || "https://experiencecoffee.co").replace(/\/$/, "");
    const req = new Request(`${base}/api/cron/reminders`, { method: "POST", headers: { "x-cron-key": key } });
    ctx.waitUntil(handler.fetch(req, env, ctx));
  },
};
