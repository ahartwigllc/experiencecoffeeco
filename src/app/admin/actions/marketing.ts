"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { renderCampaign } from "@/lib/campaign";
import { randomToken, sha256Hex } from "@/lib/crypto";
import { button, emailLayout, isEmailConfigured, sendBatch, sendEmail, type Mail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { flash } from "@/lib/flash";
import { normalizeEmail } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "@/lib/unsubscribe";

const PAGE = "/admin/marketing";

export async function createCampaign(formData: FormData) {
  const me = await requireOwner();
  const subject = String(formData.get("subject") ?? "").trim();
  if (!subject) flash(PAGE, "error", "Give the email a subject.");
  const [row] = await db()
    .insert(schema.campaigns)
    .values({
      subject,
      createdById: me.id,
      bodyMarkdown:
        "A new lot just came off the roaster.\n\n## What's in the cup\n\n- Note one\n- Note two\n\n{{button: Shop now | " + siteUrl() + "/shop}}\n\nThanks for being here,\nAndrew and G",
    })
    .returning({ id: schema.campaigns.id });
  flash(`${PAGE}/${row!.id}`, "ok", "Draft created.");
}

export async function saveCampaign(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const c = await db().query.campaigns.findFirst({ where: eq(schema.campaigns.id, id) });
  if (!c || c.status !== "draft") flash(PAGE, "error", "Only drafts can be edited.");
  await db()
    .update(schema.campaigns)
    .set({
      subject: String(formData.get("subject") ?? "").trim() || c.subject,
      previewText: String(formData.get("previewText") ?? "").trim() || null,
      bodyMarkdown: String(formData.get("bodyMarkdown") ?? ""),
      updatedAt: new Date(),
    })
    .where(eq(schema.campaigns.id, id));
  revalidatePath(`${PAGE}/${id}`);
  flash(`${PAGE}/${id}`, "ok", "Saved.");
}

export async function sendTestCampaign(formData: FormData) {
  const me = await requireOwner();
  const id = Number(formData.get("id"));
  const c = await db().query.campaigns.findFirst({ where: eq(schema.campaigns.id, id) });
  if (!c) flash(PAGE, "error", "Campaign not found.");
  const to = normalizeEmail(formData.get("to")) ?? me.email;
  const { html, text } = renderCampaign(c, await getSettings(), await unsubscribeUrl(to));
  const r = await sendEmail({ to, subject: `[Test] ${c.subject}`, html, text });
  flash(`${PAGE}/${id}`, r.ok ? "ok" : "error", r.ok ? `Test sent to ${to}.` : `Test failed: ${r.error}`);
}

export async function sendCampaign(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  if (!isEmailConfigured()) flash(`${PAGE}/${id}`, "error", "Connect Resend (RESEND_API_KEY) before sending.");
  if (formData.get("confirm") !== "SEND") flash(`${PAGE}/${id}`, "error", "Type SEND to confirm.");

  // Claim the draft atomically so a double click can't send twice.
  const [claimed] = await db()
    .update(schema.campaigns)
    .set({ status: "sending", updatedAt: new Date() })
    .where(and(eq(schema.campaigns.id, id), eq(schema.campaigns.status, "draft")))
    .returning();
  if (!claimed) flash(`${PAGE}/${id}`, "error", "This email was already sent or is sending.");

  const settings = await getSettings();
  const list = await db().select().from(schema.subscribers).where(eq(schema.subscribers.status, "subscribed"));
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const messages: Mail[] = [];
    for (const s of chunk) {
      const unsub = await unsubscribeUrl(s.email);
      const { html, text } = renderCampaign(claimed, settings, unsub);
      messages.push({
        to: s.email,
        subject: claimed.subject,
        html,
        text,
        replyTo: settings.supportEmail,
        headers: {
          "List-Unsubscribe": `<${await oneClickUnsubscribeUrl(s.email)}>, <mailto:${settings.supportEmail}?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
    }
    const results = await sendBatch(messages);
    await db()
      .insert(schema.campaignSends)
      .values(
        chunk.map((s, idx) => ({
          campaignId: id,
          subscriberId: s.id,
          email: s.email,
          providerId: results[idx]?.id ?? null,
          status: results[idx]?.ok ? "sent" : "failed",
          error: results[idx]?.ok ? null : results[idx]?.error ?? "unknown",
        })),
      );
    sent += results.filter((r) => r.ok).length;
    failed += results.filter((r) => !r.ok).length;
  }
  await db()
    .update(schema.campaigns)
    .set({ status: "sent", sentAt: new Date(), recipientCount: sent, failedCount: failed, updatedAt: new Date() })
    .where(eq(schema.campaigns.id, id));
  revalidatePath(PAGE);
  flash(`${PAGE}/${id}`, failed ? "error" : "ok", `Sent to ${sent} subscriber${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`);
}

export async function duplicateCampaign(formData: FormData) {
  const me = await requireOwner();
  const c = await db().query.campaigns.findFirst({ where: eq(schema.campaigns.id, Number(formData.get("id"))) });
  if (!c) flash(PAGE, "error", "Campaign not found.");
  const [row] = await db()
    .insert(schema.campaigns)
    .values({ subject: `${c.subject} (copy)`, previewText: c.previewText, bodyMarkdown: c.bodyMarkdown, createdById: me.id })
    .returning({ id: schema.campaigns.id });
  flash(`${PAGE}/${row!.id}`, "ok", "Copied into a new draft.");
}

export async function deleteCampaign(formData: FormData) {
  await requireOwner();
  await db()
    .delete(schema.campaigns)
    .where(and(eq(schema.campaigns.id, Number(formData.get("id"))), eq(schema.campaigns.status, "draft")));
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Draft deleted.");
}

/**
 * Adds people to the list. With "permission" checked they're subscribed right away
 * (only do this when they told you yes, e.g. a sign-up sheet). Otherwise each gets a
 * confirmation email and joins when they click it.
 */
export async function addSubscribers(formData: FormData) {
  await requireOwner();
  const raw = String(formData.get("emails") ?? "");
  const emails = [...new Set(raw.split(/[\s,;]+/).map(normalizeEmail).filter((e): e is string => !!e))].slice(0, 500);
  if (!emails.length) flash(PAGE, "error", "Paste at least one valid email.");
  const permission = formData.get("permission") === "on";
  const existing = await db().select().from(schema.subscribers).where(inArray(schema.subscribers.email, emails));
  const known = new Map(existing.map((s) => [s.email, s]));
  let added = 0;
  let skipped = 0;
  for (const email of emails) {
    const prev = known.get(email);
    if (prev?.status === "subscribed" || prev?.status === "unsubscribed") {
      skipped++; // never re-subscribe someone who opted out
      continue;
    }
    if (permission) {
      await db()
        .insert(schema.subscribers)
        .values({ email, status: "subscribed", source: "admin", confirmedAt: new Date() })
        .onConflictDoUpdate({ target: schema.subscribers.email, set: { status: "subscribed", confirmedAt: new Date() } });
    } else {
      const token = randomToken(24);
      const tokenHash = await sha256Hex(token);
      await db()
        .insert(schema.subscribers)
        .values({ email, status: "pending", source: "admin", confirmTokenHash: tokenHash })
        .onConflictDoUpdate({ target: schema.subscribers.email, set: { confirmTokenHash: tokenHash } });
      await sendEmail({
        to: email,
        subject: "Confirm your Experience Coffee sign-up",
        html: emailLayout({
          title: "One click to confirm",
          bodyHtml: `<p>Confirm your email and we'll let you know when new lots land.</p>${button("Confirm my email", `${siteUrl()}/newsletter/confirm?token=${token}`)}`,
        }),
      });
    }
    added++;
  }
  revalidatePath(PAGE);
  flash(PAGE, "ok", `${permission ? "Subscribed" : "Sent confirmation to"} ${added}. ${skipped ? `Skipped ${skipped} already subscribed or opted out.` : ""}`);
}

export async function setSubscriberStatus(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status"));
  if (status !== "unsubscribed") flash(PAGE, "error", "Subscribers can only be re-added by confirming themselves.");
  await db().update(schema.subscribers).set({ status: "unsubscribed", unsubscribedAt: new Date() }).where(eq(schema.subscribers.id, id));
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Unsubscribed.");
}
