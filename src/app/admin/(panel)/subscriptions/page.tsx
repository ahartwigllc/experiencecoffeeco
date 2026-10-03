import Link from "next/link";
import { desc } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { customerName } from "@/lib/customers";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { INTERVALS, isInterval, monthlyValueCents } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { stripeDashboardUrl } from "@/lib/stripe";
import { changeSubscription, getLegacySubscribers, inviteLegacySubscriber, syncAllSubscriptions } from "../../actions/subscriptions";

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const [subs, legacy, settings] = await Promise.all([
    db().query.subscriptions.findMany({ with: { items: true, customer: true }, orderBy: [desc(schema.subscriptions.createdAt)] }),
    getLegacySubscribers(),
    getSettings(),
  ]);
  const live = subs.filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const mrr = live
    .filter((s) => !s.paused)
    .reduce((a, s) => a + s.items.reduce((b, i) => b + (isInterval(s.interval) ? monthlyValueCents(i.unitPriceCents, i.quantity, s.interval) : 0), 0), 0);

  return (
    <>
      <div className="admin-head">
        <h1>Subscriptions</h1>
        <form action={syncAllSubscriptions}>
          <button className="btn btn-small btn-ghost" type="submit">
            Refresh from Stripe
          </button>
        </form>
      </div>
      <Flash {...sp} />
      <div className="stats">
        <div className="stat"><div className="stat-label">Active</div><div className="stat-value">{live.length}</div></div>
        <div className="stat"><div className="stat-label">Paused</div><div className="stat-value">{live.filter((s) => s.paused).length}</div></div>
        <div className="stat"><div className="stat-label">Monthly recurring revenue</div><div className="stat-value">{formatCents(mrr)}</div></div>
        <div className="stat"><div className="stat-label">Past due</div><div className={`stat-value ${live.some((s) => s.status === "past_due") ? "negative" : ""}`}>{live.filter((s) => s.status === "past_due").length}</div></div>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Items</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Next order</th>
              <th className="num">Per month</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => {
              const monthly = s.items.reduce((b, i) => b + (isInterval(s.interval) ? monthlyValueCents(i.unitPriceCents, i.quantity, s.interval) : 0), 0);
              const live = ["active", "trialing", "past_due"].includes(s.status);
              return (
                <tr key={s.id}>
                  <td>
                    {s.customer ? <Link href={`/admin/customers/${s.customer.id}`}>{customerName(s.customer)}</Link> : "Unknown"}
                    <div className="small muted">{s.fulfillmentMethod}</div>
                  </td>
                  <td className="small">{s.items.map((i) => `${i.quantity}× ${i.title} (${formatCents(i.unitPriceCents)})`).join(", ")}</td>
                  <td>{isInterval(s.interval) ? INTERVALS[s.interval].label : s.interval}</td>
                  <td>
                    <span className={`badge ${s.status === "active" && !s.paused ? "green" : s.status === "past_due" ? "red" : "amber"}`}>
                      {s.paused ? "paused" : s.cancelAtPeriodEnd ? "ending" : s.status}
                    </span>
                  </td>
                  <td>{live && !s.paused ? formatDate(s.currentPeriodEnd) : "—"}</td>
                  <td className="num">{formatCents(monthly)}</td>
                  <td>
                    {live && (
                      <form action={changeSubscription} className="toolbar">
                        <input type="hidden" name="stripeId" value={s.stripeSubscriptionId} />
                        {s.paused ? (
                          <button className="btn btn-small btn-ghost" name="action" value="resume" type="submit">Resume</button>
                        ) : (
                          <button className="btn btn-small btn-ghost" name="action" value="pause" type="submit">Pause</button>
                        )}
                        {s.cancelAtPeriodEnd ? (
                          <button className="btn btn-small btn-ghost" name="action" value="keep" type="submit">Keep</button>
                        ) : (
                          <button className="btn btn-small btn-ghost" name="action" value="cancel_end" type="submit">Cancel at period end</button>
                        )}
                        <ConfirmButton name="action" value="cancel_now" message="Cancel immediately? The customer won't be charged again.">
                          Cancel now
                        </ConfirmButton>
                      </form>
                    )}
                    <a className="small" href={stripeDashboardUrl(`subscriptions/${s.stripeSubscriptionId}`)} target="_blank" rel="noopener">
                      Stripe
                    </a>
                  </td>
                </tr>
              );
            })}
            {subs.length === 0 && (
              <tr><td colSpan={7} className="muted">No subscriptions on the new site yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Subscribers from the old Shopify store</h2>
      <p className="muted small">
        Found in your imported order history. Their payment details stay with Shopify, so invite each one to restart here (one click
        for them), then cancel their old Shopify subscription. People drop off this list once they re-subscribe.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Was getting</th>
              <th>Schedule</th>
              <th>Last Shopify order</th>
              <th className="num">Renewals</th>
              <th>Invite</th>
            </tr>
          </thead>
          <tbody>
            {legacy.map((l) => (
              <tr key={l.email}>
                <td>{l.name ?? ""}<div className="small muted">{l.email}</div></td>
                <td>{l.quantity}× {l.title}</td>
                <td>{isInterval(l.interval) ? INTERVALS[l.interval].label : l.interval}</td>
                <td>{formatDate(l.last)}</td>
                <td className="num">{l.count}</td>
                <td>
                  <form action={inviteLegacySubscriber}>
                    <input type="hidden" name="email" value={l.email} />
                    <button className="btn btn-small btn-ghost" type="submit">
                      {settings.legacyInvitesSent[l.email] ? `Resend (sent ${formatDate(settings.legacyInvitesSent[l.email])})` : "Send invite"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {legacy.length === 0 && <tr><td colSpan={6} className="muted">None left to move. Every former subscriber has re-subscribed, or history hasn't been imported yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
