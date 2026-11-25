"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { button, emailLayout, sendEmail } from "@/lib/email";
import { flash } from "@/lib/flash";
import { escapeHtml } from "@/lib/markdown";
import { formatBillingDay, nextBillingDay } from "@/lib/billing-day";
import { legacyInterval, listLegacySubscribers, restartUrl, type LegacySubscriber } from "@/lib/legacy-subscribers";
import { formatCents } from "@/lib/money";
import { INTERVALS, resolveSubscriptionDiscount, subscriberPrice } from "@/lib/pricing";
import { getSettings, saveSettings } from "@/lib/settings";
import { stripe } from "@/lib/stripe";
import { upsertSubscription } from "@/lib/stripe-sync";

const PAGE = "/admin/subscriptions";

export async function changeSubscription(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("stripeId"));
  const action = String(formData.get("action"));
  try {
    if (action === "pause") await stripe().subscriptions.update(id, { pause_collection: { behavior: "void" } });
    else if (action === "resume") await stripe().subscriptions.update(id, { pause_collection: "" });
    else if (action === "cancel_end") await stripe().subscriptions.update(id, { cancel_at_period_end: true });
    else if (action === "keep") await stripe().subscriptions.update(id, { cancel_at_period_end: false });
    else if (action === "cancel_now") await stripe().subscriptions.cancel(id);
    else flash(PAGE, "error", "Unknown action.");
    await upsertSubscription(id);
  } catch (err) {
    flash(PAGE, "error", `Stripe error: ${err instanceof Error ? err.message : "unknown"}`);
  }
  revalidatePath(PAGE);
  const labels: Record<string, string> = {
    pause: "Paused. No renewals until you resume.",
    resume: "Resumed.",
    cancel_end: "Will cancel at the end of the current period.",
    keep: "Cancellation withdrawn.",
    cancel_now: "Cancelled.",
  };
  flash(PAGE, "ok", labels[action] ?? "Updated.");
}

export async function syncAllSubscriptions() {
  await requireOwner();
  const all = await db().select({ id: schema.subscriptions.stripeSubscriptionId }).from(schema.subscriptions);
  let n = 0;
  for (const s of all) {
    try {
      await upsertSubscription(s.id);
      n++;
    } catch (err) {
      console.error("sync failed", s.id, err);
    }
  }
  revalidatePath(PAGE);
  flash(PAGE, "ok", `Refreshed ${n} subscription${n === 1 ? "" : "s"} from Stripe.`);
}

/** Former Shopify subscribers, inferred from imported order history. */
export async function getLegacySubscribers() {
  return listLegacySubscribers();
}

async function sendInvite(l: LegacySubscriber, supportEmail: string) {
  const settings = await getSettings();
  const interval = legacyInterval(l);
  const product = l.productId ? await db().query.products.findFirst({ where: eq(schema.products.id, l.productId), with: { variants: true } }) : null;
  const variant = product?.variants.find((v) => v.id === l.variantId);
  const price = product && variant ? subscriberPrice(variant.priceCents, resolveSubscriptionDiscount(product, settings.subscriptionDiscountPercent), variant.noSubscriptionDiscount) : null;
  const first = l.name?.split(" ")[0];
  const coldBrew = product?.kind === "cold_brew";
  const next = coldBrew ? formatBillingDay(nextBillingDay(new Date(Math.max(Date.now(), l.nextDue.getTime() - 12 * 3600_000)))) : formatBillingDay(l.nextDue);
  const url = await restartUrl(l.email);
  return sendEmail({
    to: l.email,
    replyTo: supportEmail,
    subject: "Please approve your Experience Coffee subscription",
    html: emailLayout({
      title: `${first ? `${escapeHtml(first)}, one` : "One"} quick tap to keep your coffee coming`,
      preview: "We've moved to our own website. Approve your subscription in one step.",
      bodyHtml: `<p>We've moved Experience Coffee off Shopify and onto our own website. Your subscription can't move by itself because your card stayed with Shopify, so we just need your OK.</p>
<p><strong>${escapeHtml(l.quantity > 1 ? `${l.quantity} × ` : "")}${escapeHtml(l.title)}</strong>, ${escapeHtml(INTERVALS[interval].short)}${price !== null ? `, ${formatCents(price)} each time (your subscriber price)` : ""}.</p>
${button("Approve my subscription", url)}
<p>Tap the button, confirm your card once on our secure Stripe checkout, and you're done. <strong>Nothing is charged today.</strong> Your next order goes through on <strong>${escapeHtml(next)}</strong>, right on your usual schedule${coldBrew ? " (cold brew is billed Wednesdays, brewed Thursday into Friday, and delivered Saturday)" : ""}.</p>
<p style="font-size:14px;color:#76614A;">We'll cancel your old Shopify subscription as soon as you approve, so you'll never be charged twice. You can skip, pause, or cancel any time from your account. Questions? Just reply.</p>`,
    }),
  });
}

export async function inviteLegacySubscriber(formData: FormData) {
  await requireOwner();
  const email = String(formData.get("email") ?? "").toLowerCase();
  const legacy = (await listLegacySubscribers()).find((l) => l.email === email);
  if (!legacy) flash(PAGE, "error", "That customer isn't in the Shopify subscriber list.");
  const settings = await getSettings();
  const r = await sendInvite(legacy, settings.supportEmail);
  if (!r.ok) flash(PAGE, "error", `Invite not sent: ${r.error}`);
  await saveSettings({ legacyInvitesSent: { ...settings.legacyInvitesSent, [email]: new Date().toISOString() } });
  revalidatePath(PAGE);
  flash(PAGE, "ok", `Approval email sent to ${email}.`);
}

export async function inviteAllActiveLegacy() {
  await requireOwner();
  const settings = await getSettings();
  const active = (await listLegacySubscribers()).filter((l) => l.active);
  const sent: Record<string, string> = { ...settings.legacyInvitesSent };
  const failed: string[] = [];
  for (const l of active) {
    const r = await sendInvite(l, settings.supportEmail);
    if (r.ok) sent[l.email] = new Date().toISOString();
    else failed.push(l.email);
  }
  await saveSettings({ legacyInvitesSent: sent });
  revalidatePath(PAGE);
  if (failed.length) flash(PAGE, "error", `Sent ${active.length - failed.length}; failed for ${failed.join(", ")}.`);
  flash(PAGE, "ok", `Approval emails sent to ${active.length} current Shopify subscriber${active.length === 1 ? "" : "s"}.`);
}
