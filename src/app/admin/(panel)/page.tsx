import Link from "next/link";
import { and, asc, count, eq, inArray, isNull, lte } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { customerName } from "@/lib/customers";
import { formatDateTime, formatTime, rangeBounds } from "@/lib/dates";
import { isEmailConfigured } from "@/lib/email";
import { getFinanceReport } from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { isInterval, monthlyValueCents } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const settings = await getSettings();
  const today = rangeBounds("today");
  const month = rangeBounds("month");

  const [todayReport, monthReport, toPrepare, review, clockedIn, lowStock, subs, subscriberCount, unread, missingCost, events] =
    await Promise.all([
      getFinanceReport(today.start, today.end, settings),
      getFinanceReport(month.start, month.end, settings),
      db().query.orders.findMany({
        where: and(inArray(schema.orders.status, ["paid", "partially_refunded"]), inArray(schema.orders.fulfillmentStatus, ["unfulfilled", "ready"])),
        with: { items: true, customer: true },
        orderBy: [asc(schema.orders.createdAt)],
        limit: 25,
      }),
      db().select({ value: count() }).from(schema.orders).where(eq(schema.orders.needsReview, true)),
      db().query.timeEntries.findMany({ where: isNull(schema.timeEntries.clockOut), with: { staff: true } }),
      db()
        .select({ v: schema.variants, title: schema.products.title })
        .from(schema.variants)
        .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
        .where(
          and(
            eq(schema.variants.trackInventory, true),
            eq(schema.variants.active, true),
            eq(schema.products.status, "active"),
            lte(schema.variants.inventory, settings.lowInventoryThreshold),
          ),
        )
        .orderBy(asc(schema.variants.inventory))
        .limit(12),
      db().query.subscriptions.findMany({ where: inArray(schema.subscriptions.status, ["active", "trialing", "past_due"]), with: { items: true } }),
      db().select({ value: count() }).from(schema.subscribers).where(eq(schema.subscribers.status, "subscribed")),
      db().select({ value: count() }).from(schema.contactMessages).where(eq(schema.contactMessages.handled, false)),
      db()
        .select({ value: count() })
        .from(schema.variants)
        .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
        .where(and(isNull(schema.variants.unitCostCents), eq(schema.products.status, "active"), eq(schema.variants.active, true))),
      db().select({ value: count() }).from(schema.stripeEvents),
    ]);

  const mrr = subs
    .filter((s) => !s.paused)
    .reduce((a, s) => a + s.items.reduce((b, i) => b + (isInterval(s.interval) ? monthlyValueCents(i.unitPriceCents, i.quantity, s.interval) : 0), 0), 0);
  const m = monthReport.total;

  const checklist = [
    { done: isStripeConfigured(), text: "Add your Stripe keys (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)" },
    { done: events[0]!.value > 0, text: "Receive a first Stripe webhook (place a test order)" },
    { done: isEmailConfigured(), text: "Connect Resend for email (RESEND_API_KEY)" },
    { done: missingCost[0]!.value === 0, text: `Enter unit costs for every product option (${missingCost[0]!.value} missing)` },
  ];

  return (
    <>
      <div className="admin-head">
        <h1>Today</h1>
        <div className="toolbar">
          <Link className="btn btn-small" href="/admin/orders/new">
            Record an order
          </Link>
          <Link className="btn btn-small btn-ghost" href="/admin/timeclock">
            Time clock
          </Link>
        </div>
      </div>
      <Flash {...sp} />

      {checklist.some((c) => !c.done) && (
        <div className="card">
          <h2>Finish setting up</h2>
          <ul>
            {checklist.map((c) => (
              <li key={c.text} style={{ textDecoration: c.done ? "line-through" : undefined, color: c.done ? "var(--muted)" : undefined }}>
                {c.text}
              </li>
            ))}
          </ul>
          <p className="small muted">Step-by-step instructions are in docs/DEPLOYMENT.md.</p>
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Sales today</div>
          <div className="stat-value">{formatCents(todayReport.total.revenueCents)}</div>
          <div className="stat-sub">{todayReport.total.orders} orders</div>
        </div>
        <div className="stat">
          <div className="stat-label">Revenue this month</div>
          <div className="stat-value">{formatCents(m.revenueCents)}</div>
          <div className="stat-sub">{m.orders} orders</div>
        </div>
        <div className="stat">
          <div className="stat-label">Net profit this month</div>
          <div className={`stat-value ${m.netProfitCents < 0 ? "negative" : ""}`}>{formatCents(m.netProfitCents)}</div>
          <div className="stat-sub">after fees, costs, labor, expenses</div>
        </div>
        <div className="stat">
          <div className="stat-label">Profit per hour worked</div>
          <div className="stat-value">{m.profitPerHourCents === null ? "—" : formatCents(m.profitPerHourCents)}</div>
          <div className="stat-sub">{m.hoursWorked.toFixed(1)} hours this month</div>
        </div>
        <div className="stat">
          <div className="stat-label">Active subscriptions</div>
          <div className="stat-value">{subs.length}</div>
          <div className="stat-sub">{formatCents(mrr)} a month</div>
        </div>
        <div className="stat">
          <div className="stat-label">Email subscribers</div>
          <div className="stat-value">{subscriberCount[0]!.value}</div>
          <div className="stat-sub">
            <Link href="/admin/messages">{unread[0]!.value} unread messages</Link>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>To prepare ({toPrepare.length})</h2>
          {review[0]!.value > 0 && (
            <p className="flash error">
              <Link href="/admin/orders?status=review">{review[0]!.value} order(s) need review</Link>
            </p>
          )}
          {toPrepare.length === 0 ? (
            <p className="muted">Nothing waiting. Nice.</p>
          ) : (
            <table className="data">
              <tbody>
                {toPrepare.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`}>#{o.number}</Link>
                      <div className="small muted">{formatDateTime(o.createdAt)}</div>
                    </td>
                    <td>
                      {o.customer ? customerName(o.customer) : o.shipName || o.email}
                      <div className="small muted">{o.items.map((i) => `${i.quantity}× ${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ""}`).join(", ")}</div>
                    </td>
                    <td>
                      <span className={`badge ${o.fulfillmentStatus === "ready" ? "green" : "amber"}`}>
                        {o.fulfillmentStatus === "ready" ? "Ready" : o.fulfillmentMethod}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="card">
            <h2>On the clock</h2>
            {clockedIn.length === 0 ? (
              <p className="muted">Nobody is clocked in.</p>
            ) : (
              <ul>
                {clockedIn.map((t) => (
                  <li key={t.id}>
                    {t.staff.name} since {formatTime(t.clockIn)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card">
            <h2>Low stock</h2>
            {lowStock.length === 0 ? (
              <p className="muted">Everything tracked is above {settings.lowInventoryThreshold}.</p>
            ) : (
              <table className="data">
                <tbody>
                  {lowStock.map((r) => (
                    <tr key={r.v.id}>
                      <td>
                        <Link href={`/admin/products/${r.v.productId}`}>{r.title}</Link>
                        <div className="small muted">{r.v.title}</div>
                      </td>
                      <td className={`num ${r.v.inventory <= 0 ? "negative" : ""}`}>{r.v.inventory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <p className="small muted">Last updated {formatDateTime(new Date())}.</p>
    </>
  );
}

