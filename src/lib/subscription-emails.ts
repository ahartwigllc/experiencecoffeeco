import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { BILLING_TZ, formatBillingDay, WEDNESDAY_NOTE } from "./billing-day";
import { button, emailLayout, sendEmail } from "./email";
import { siteUrl } from "./env";
import { escapeHtml } from "./markdown";
import { formatCents } from "./money";
import { INTERVALS, isInterval } from "./pricing";
import { getSettings } from "./settings";

async function loadSub(stripeSubscriptionId: string) {
  return db().query.subscriptions.findFirst({
    where: eq(schema.subscriptions.stripeSubscriptionId, stripeSubscriptionId),
    with: { items: true, customer: true },
  });
}

type LoadedSub = NonNullable<Awaited<ReturnType<typeof loadSub>>>;

function itemsHtml(sub: LoadedSub): string {
  return `<ul>${sub.items
    .map((i) => `<li>${escapeHtml(i.title)} × ${i.quantity}: ${formatCents(i.unitPriceCents * i.quantity)}</li>`)
    .join("")}</ul>`;
}

const totalOf = (sub: LoadedSub) => sub.items.reduce((a, i) => a + i.unitPriceCents * i.quantity, 0);
const scheduleOf = (sub: LoadedSub) => (isInterval(sub.interval) ? INTERVALS[sub.interval].short : sub.interval);

/** Confirmation for a Wednesday-billed subscription, which has no order until its first charge. */
export async function sendSubscriptionStartedEmails(stripeSubscriptionId: string): Promise<void> {
  const sub = await loadSub(stripeSubscriptionId);
  if (!sub) return;
  const s = await getSettings();
  const first = sub.currentPeriodEnd ? formatBillingDay(sub.currentPeriodEnd) : "Wednesday";
  const email = sub.customer?.email;
  if (email) {
    await sendEmail({
      to: email,
      replyTo: s.supportEmail,
      subject: `Your cold brew subscription starts ${first}`,
      html: emailLayout({
        title: "You're subscribed",
        preview: `Your first charge is ${first}.`,
        bodyHtml: `<p>Thanks for subscribing. ${escapeHtml(WEDNESDAY_NOTE)}</p>
<p><strong>Nothing was charged today.</strong> Your first charge and order go through on <strong>${escapeHtml(first)}</strong>, then ${escapeHtml(scheduleOf(sub))} on Wednesdays after that. We'll email you two days before each charge.</p>
${itemsHtml(sub)}
<p>Total each time: <strong>${formatCents(totalOf(sub))}</strong> (before any discount code).</p>
${button("Manage your subscription", `${siteUrl()}/account`)}
<p style="font-size:14px;color:#76614A;">Need to skip, pause, or cancel? You can do it any time from your account, or reply to this email.</p>`,
      }),
    });
  }
  if (s.ownerNotifyEmail) {
    const who = sub.shipName || email || "a customer";
    await sendEmail({
      to: s.ownerNotifyEmail,
      subject: `New cold brew subscription: ${who}, first charge ${first}`,
      html: emailLayout({
        title: "New subscription",
        bodyHtml: `<p>${escapeHtml(who)} subscribed (${escapeHtml(scheduleOf(sub))}, ${escapeHtml(sub.fulfillmentMethod)}). First charge and order: ${escapeHtml(first)}.</p>${itemsHtml(sub)}${button("Open subscriptions", `${siteUrl()}/admin/subscriptions`)}`,
      }),
    });
  }
}

/**
 * Emails every active subscriber whose card will be charged in about two days.
 * Run once a day (Cloudflare cron). Each renewal date is reminded at most once.
 */
export async function sendRenewalReminders(now: Date = new Date()): Promise<{ sent: number; checked: number }> {
  const from = new Date(now.getTime() + 36 * 3600_000);
  const to = new Date(now.getTime() + 60 * 3600_000);
  const due = await db().query.subscriptions.findMany({
    where: and(
      inArray(schema.subscriptions.status, ["active", "trialing"]),
      eq(schema.subscriptions.paused, false),
      eq(schema.subscriptions.cancelAtPeriodEnd, false),
      gte(schema.subscriptions.currentPeriodEnd, from),
      lte(schema.subscriptions.currentPeriodEnd, to),
    ),
    with: { items: true, customer: true },
  });
  const s = await getSettings();
  let sent = 0;
  for (const sub of due) {
    const when = sub.currentPeriodEnd!;
    if (sub.reminderSentFor && sub.reminderSentFor.getTime() === when.getTime()) continue;
    const email = sub.customer?.email;
    if (email) {
      const day = formatBillingDay(when, BILLING_TZ);
      const r = await sendEmail({
        to: email,
        replyTo: s.supportEmail,
        subject: `Heads up: your Experience Coffee subscription renews ${day}`,
        html: emailLayout({
          title: "Your next order is coming up",
          preview: `We'll charge your card on ${day}.`,
          bodyHtml: `<p>Just a heads up: your subscription renews on <strong>${escapeHtml(day)}</strong>, and we'll charge the card on file then.</p>
${itemsHtml(sub)}
<p>Total: <strong>${formatCents(totalOf(sub))}</strong> (before any discount code).</p>
<p>Want to skip this one, pause, or change something? Do it before ${escapeHtml(day)}.</p>
${button("Manage your subscription", `${siteUrl()}/account`)}
<p style="font-size:14px;color:#76614A;">Questions? Reply to this email.</p>`,
        }),
      });
      if (!r.ok && !r.skipped) continue; // try again on the next run
      sent++;
    }
    await db().update(schema.subscriptions).set({ reminderSentFor: when }).where(eq(schema.subscriptions.id, sub.id));
  }
  return { sent, checked: due.length };
}
