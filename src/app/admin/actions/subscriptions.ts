"use server";

import { eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { button, emailLayout, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/env";
import { flash } from "@/lib/flash";
import { escapeHtml } from "@/lib/markdown";
import { INTERVALS, isInterval } from "@/lib/pricing";
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
  const rows = await db()
    .select({
      email: schema.orders.email,
      name: schema.orders.shipName,
      createdAt: schema.orders.createdAt,
      title: schema.orderItems.title,
      variantTitle: schema.orderItems.variantTitle,
      variantId: schema.orderItems.variantId,
      productId: schema.orderItems.productId,
      interval: schema.orderItems.subscriptionInterval,
      quantity: schema.orderItems.quantity,
      status: schema.orders.status,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(sql`${schema.orders.source} = 'shopify' and ${schema.orderItems.subscriptionInterval} is not null and ${schema.orders.email} is not null`)
    .orderBy(schema.orders.createdAt);

  const byEmail = new Map<string, { email: string; name: string | null; last: Date; count: number; interval: string; title: string; productId: number | null; quantity: number }>();
  for (const r of rows) {
    const e = r.email!.toLowerCase();
    const prev = byEmail.get(e);
    byEmail.set(e, {
      email: e,
      name: r.name ?? prev?.name ?? null,
      last: r.createdAt,
      count: (prev?.count ?? 0) + 1,
      interval: r.interval!,
      title: r.title,
      productId: r.productId,
      quantity: r.quantity,
    });
  }
  // Anyone who already re-subscribed on the new site is no longer "legacy".
  const emails = [...byEmail.keys()];
  if (emails.length) {
    const resubbed = await db()
      .select({ email: schema.customers.email })
      .from(schema.subscriptions)
      .innerJoin(schema.customers, eq(schema.customers.id, schema.subscriptions.customerId))
      .where(inArray(schema.customers.email, emails));
    for (const r of resubbed) if (r.email) byEmail.delete(r.email);
  }
  return [...byEmail.values()].sort((a, b) => b.last.getTime() - a.last.getTime());
}

export async function inviteLegacySubscriber(formData: FormData) {
  await requireOwner();
  const email = String(formData.get("email") ?? "").toLowerCase();
  const legacy = (await getLegacySubscribers()).find((l) => l.email === email);
  if (!legacy) flash(PAGE, "error", "That customer isn't in the Shopify subscriber list.");
  const settings = await getSettings();
  const product = legacy.productId ? await db().query.products.findFirst({ where: eq(schema.products.id, legacy.productId) }) : null;
  const interval = isInterval(legacy.interval) ? legacy.interval : "month";
  const url = product ? `${siteUrl()}/products/${product.handle}?subscribe=${interval}` : `${siteUrl()}/shop`;
  const first = legacy.name?.split(" ")[0];
  const r = await sendEmail({
    to: email,
    replyTo: settings.supportEmail,
    subject: "Your Experience Coffee subscription has a new home",
    html: emailLayout({
      title: `${first ? `${first}, your` : "Your"} subscription is moving`,
      bodyHtml: `<p>We've moved to our own website, so subscriptions from the old store don't carry over automatically. It takes about a minute to set yours back up, and you'll keep your subscriber discount.</p>
<p>You were getting <strong>${escapeHtml(legacy.title)}</strong>, ${escapeHtml(INTERVALS[interval].short)}.</p>
${button("Restart my subscription", url)}
<p style="font-size:14px;color:#6B5E57;">Your old subscription on the previous store has been or will be cancelled, so you won't be charged twice. Questions? Just reply.</p>`,
    }),
  });
  if (!r.ok) flash(PAGE, "error", `Invite not sent: ${r.error}`);
  await saveSettings({ legacyInvitesSent: { ...settings.legacyInvitesSent, [email]: new Date().toISOString() } });
  revalidatePath(PAGE);
  flash(PAGE, "ok", `Invite sent to ${email}.`);
}

