import { NextResponse } from "next/server";
import { safeEqual, sha256Hex } from "@/lib/crypto";
import { sendRenewalReminders } from "@/lib/subscription-emails";

export const dynamic = "force-dynamic";

/**
 * Called once a day by the Cloudflare cron trigger (see custom-worker.ts).
 * The key is derived from the Stripe webhook secret so no extra secret is needed.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const expected = await sha256Hex(`cron:${secret}`);
  if (!safeEqual(req.headers.get("x-cron-key") ?? "", expected)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await sendRenewalReminders();
  return NextResponse.json(result);
}
