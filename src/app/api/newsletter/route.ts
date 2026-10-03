import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { button, emailLayout, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { isSameOrigin, json, normalizeEmail } from "@/lib/http";

/** Newsletter sign-up with double opt-in (a confirmation email must be clicked). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Invalid request origin." }, 403);
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Enter your email to sign up." }, 400);
  if (form.get("company")) return json({ ok: true }); // honeypot: bots fill hidden fields
  const email = normalizeEmail(form.get("email"));
  if (!email) return json({ error: "Enter a valid email address." }, 400);

  const existing = await db().query.subscribers.findFirst({ where: eq(schema.subscribers.email, email) });
  if (existing?.status === "subscribed") return json({ ok: true, message: "You're already on the list." });

  const token = randomToken(24);
  const tokenHash = await sha256Hex(token);
  if (existing) {
    await db()
      .update(schema.subscribers)
      .set({ status: "pending", confirmTokenHash: tokenHash, unsubscribedAt: null })
      .where(eq(schema.subscribers.id, existing.id));
  } else {
    const customer = await db().query.customers.findFirst({ where: eq(schema.customers.email, email) });
    await db()
      .insert(schema.subscribers)
      .values({ email, status: "pending", source: String(form.get("source") || "website").slice(0, 40), confirmTokenHash: tokenHash, customerId: customer?.id ?? null })
      .onConflictDoNothing();
  }

  const url = `${siteUrl()}/newsletter/confirm?token=${token}`;
  const r = await sendEmail({
    to: email,
    subject: "Confirm your Experience Coffee sign-up",
    html: emailLayout({
      title: "One click to confirm",
      bodyHtml: `<p>Confirm your email and we'll let you know when new lots land and when we're roasting.</p>${button("Confirm my email", url)}<p style="font-size:14px;color:#6B5E57;">Didn't sign up? Ignore this email and you won't hear from us.</p>`,
    }),
  });
  if (!r.ok && !r.skipped) return json({ error: "We couldn't send the confirmation email. Try again later." }, 502);
  return json({ ok: true, message: "Check your inbox to confirm." });
}
