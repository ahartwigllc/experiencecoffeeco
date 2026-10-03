import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { AjaxForm } from "@/components/AjaxForm";
import { db, schema } from "@/db/client";
import { getCustomerEmail } from "@/lib/customer-auth";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { INTERVALS, isInterval } from "@/lib/pricing";
import { signOutCustomer } from "./actions";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const STATUS: Record<string, string> = {
  unfulfilled: "Being prepared",
  ready: "Ready",
  fulfilled: "Delivered",
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string; portal?: string }> }) {
  const { error, portal } = await searchParams;
  const email = await getCustomerEmail();

  if (!email) {
    return (
      <div className="wrap narrow">
        <div className="page-head">
          <h1>Your account</h1>
          <p className="lede">Enter the email you order with. We'll send a one-time link to see your orders and manage subscriptions.</p>
        </div>
        {error === "link" && <div className="notice error">That sign-in link has expired or was already used. Request a new one.</div>}
        <AjaxForm action="/api/account/link" submitLabel="Email me a sign-in link" inline>
          <label htmlFor="acct-email" className="sr-only">
            Email
          </label>
          <input id="acct-email" type="email" name="email" autoComplete="email" required placeholder="you@example.com" />
        </AjaxForm>
        <p className="small muted">
          Ordered on our old site? Your order history came with us. Use the same email address.
        </p>
      </div>
    );
  }

  const customer = await db().query.customers.findFirst({ where: eq(schema.customers.email, email) });
  const orders = customer
    ? await db().query.orders.findMany({
        where: eq(schema.orders.customerId, customer.id),
        with: { items: true },
        orderBy: [desc(schema.orders.createdAt)],
        limit: 50,
      })
    : [];
  const subs = customer
    ? await db().query.subscriptions.findMany({ where: eq(schema.subscriptions.customerId, customer.id), with: { items: true } })
    : [];
  const activeSubs = subs.filter((s) => s.status !== "canceled" && s.status !== "incomplete_expired");

  return (
    <div className="wrap">
      <div className="page-head">
        <h1>Hi{customer?.firstName ? `, ${customer.firstName}` : ""}</h1>
        <p className="muted">Signed in as {email}.</p>
      </div>
      {portal === "none" && (
        <div className="notice">We couldn't find saved payment details for you yet. They appear after your first order on this site.</div>
      )}

      <div className="grid-2" style={{ alignItems: "start", gap: "2.5rem" }}>
        <section>
          <h2>Subscriptions</h2>
          {activeSubs.length === 0 ? (
            <p>
              No active subscriptions. <Link href="/shop">Subscribe to a coffee</Link> and save on every order.
            </p>
          ) : (
            activeSubs.map((s) => (
              <div key={s.id} className="panel" style={{ marginBottom: "1rem" }}>
                <p style={{ margin: 0 }}>
                  <strong>{isInterval(s.interval) ? INTERVALS[s.interval].label : s.interval}</strong>
                  {s.paused ? " (paused)" : s.cancelAtPeriodEnd ? " (ends after this period)" : ""}
                </p>
                <ul>
                  {s.items.map((i) => (
                    <li key={i.id}>
                      {i.quantity} × {i.title}, {formatCents(i.unitPriceCents)}
                    </li>
                  ))}
                </ul>
                {s.currentPeriodEnd && !s.cancelAtPeriodEnd ? <p className="small muted">Next order {formatDate(s.currentPeriodEnd)}</p> : null}
              </div>
            ))
          )}
          <form action="/api/account/portal" method="post">
            <button className="btn" type="submit">
              Manage subscriptions and payment
            </button>
          </form>
          <p className="small muted">Skip, pause, change, or cancel, and update your card, on Stripe's secure page.</p>
        </section>

        <section>
          <h2>Orders</h2>
          {orders.length === 0 ? (
            <p>No orders yet.</p>
          ) : (
            <div className="menu">
              {orders.map((o) => (
                <div key={o.id} className="cart-line" style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <h3>
                      #{o.number} on {formatDate(o.createdAt)}
                    </h3>
                    <div className="sub">
                      {o.items.map((i) => `${i.quantity} × ${i.title}`).join(", ")}
                    </div>
                    <div className="sub">
                      {o.status === "refunded"
                        ? "Refunded"
                        : o.status === "cancelled"
                          ? "Cancelled"
                          : STATUS[o.fulfillmentStatus] ?? o.fulfillmentStatus}
                      {o.fulfillmentMethod === "pickup" ? ", pickup" : o.fulfillmentMethod === "delivery" ? ", delivery" : ", shipping"}
                    </div>
                  </div>
                  <div className="menu-price">{formatCents(o.totalCents)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <form action={signOutCustomer} style={{ marginTop: "2rem" }}>
        <button className="link-button" type="submit">
          Sign out
        </button>
      </form>
    </div>
  );
}
