import { db, schema } from "@/db/client";
import { emailLayout, sendEmail } from "@/lib/email";
import { isSameOrigin, json, normalizeEmail } from "@/lib/http";
import { escapeHtml } from "@/lib/markdown";
import { getSettings } from "@/lib/settings";

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: "Invalid request origin." }, 403);
  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: "Fill in the form to send a message." }, 400);
  if (form.get("company")) return json({ ok: true });
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const email = normalizeEmail(form.get("email"));
  const message = String(form.get("message") ?? "").trim().slice(0, 5000);
  if (!name || !email || message.length < 2) return json({ error: "Add your name, a valid email, and a message." }, 400);

  await db().insert(schema.contactMessages).values({ name, email, message });
  const s = await getSettings();
  await sendEmail({
    to: s.ownerNotifyEmail,
    replyTo: email,
    subject: `Website message from ${name}`,
    html: emailLayout({
      title: `Message from ${name}`,
      bodyHtml: `<p><strong>${escapeHtml(email)}</strong></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
    }),
  });
  return json({ ok: true, message: "Thanks. We'll get back to you soon." });
}
