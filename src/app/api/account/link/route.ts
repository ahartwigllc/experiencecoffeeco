import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { button, emailLayout, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { isSameOrigin, json, normalizeEmail } from "@/lib/http";

const GENERIC = "If that email has orders with us, a sign-in link is on its way. It works for 30 minutes.";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Invalid request origin." }, 403);
  const form = await req.formData().catch(() => null);
  const email = normalizeEmail(form?.get("email"));
  if (!email) return json({ error: "Enter a valid email address." }, 400);

  // Throttle: at most 3 links per email per 15 minutes.
  const [{ n }] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.magicLinks)
    .where(and(eq(schema.magicLinks.email, email), gt(schema.magicLinks.createdAt, new Date(Date.now() - 15 * 60_000))));
  if (n >= 3) return json({ ok: true, message: GENERIC });

  const customer = await db().query.customers.findFirst({ where: eq(schema.customers.email, email) });
  if (!customer) return json({ ok: true, message: GENERIC }); // don't reveal who has an account

  const token = randomToken(32);
  await db()
    .insert(schema.magicLinks)
    .values({ tokenHash: await sha256Hex(token), email, expiresAt: new Date(Date.now() + 30 * 60_000) });
  await sendEmail({
    to: email,
    subject: "Your Experience Coffee sign-in link",
    html: emailLayout({
      title: "Sign in to your account",
      bodyHtml: `<p>Use this link to see your orders and manage your subscription. It expires in 30 minutes and works once.</p>${button("Sign in", `${siteUrl()}/account/verify?token=${token}`)}<p style="font-size:14px;color:#6B5E57;">Didn't ask for this? You can ignore it.</p>`,
    }),
  });
  return json({ ok: true, message: GENERIC });
}
