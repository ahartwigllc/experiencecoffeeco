import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { bulkFulfill } from "../../actions/orders";
import { statusBadge } from "@/components/admin/StatusBadge";

const PAGE = 50;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; method?: string; source?: string; q?: string; page?: string; ok?: string; error?: string }>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: SQL[] = [];
  if (sp.status === "open")
    where.push(inArray(schema.orders.fulfillmentStatus, ["unfulfilled", "ready"]), inArray(schema.orders.status, ["paid", "partially_refunded"]));
  else if (sp.status === "review") where.push(eq(schema.orders.needsReview, true));
  else if (sp.status && ["paid", "refunded", "partially_refunded", "cancelled", "pending"].includes(sp.status))
    where.push(eq(schema.orders.status, sp.status as "paid"));
  if (sp.method && ["pickup", "delivery", "shipping"].includes(sp.method)) where.push(eq(schema.orders.fulfillmentMethod, sp.method as "pickup"));
  if (sp.source && ["web", "subscription", "manual", "shopify"].includes(sp.source)) where.push(eq(schema.orders.source, sp.source as "web"));
  const q = sp.q?.trim();
  if (q) {
    const num = Number(q.replace("#", ""));
    where.push(
      or(
        ilike(schema.orders.email, `%${q}%`),
        ilike(schema.orders.shipName, `%${q}%`),
        ilike(schema.orders.phone, `%${q}%`),
        ...(Number.isInteger(num) && num > 0 ? [eq(schema.orders.number, num)] : []),
      )!,
    );
  }
  const filter = where.length ? and(...where) : undefined;

  const [orders, [{ total }]] = await Promise.all([
    db().query.orders.findMany({
      where: filter,
      with: { items: true },
      orderBy: [desc(schema.orders.createdAt)],
      limit: PAGE,
      offset: (page - 1) * PAGE,
    }),
    db().select({ total: sql<number>`count(*)::int` }).from(schema.orders).where(filter),
  ]);
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: sp.status, method: sp.method, source: sp.source, q: sp.q, ...extra }))
      if (v !== undefined && v !== "") p.set(k, String(v));
    return `?${p.toString()}`;
  };

  return (
    <>
      <div className="admin-head">
        <h1>Orders</h1>
        <div className="toolbar">
          <Link className="btn btn-small" href="/admin/orders/new">
            Record an order
          </Link>
          <a className="btn btn-small btn-ghost" href={`/admin/orders/export${qs({})}`}>
            Export CSV
          </a>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <form className="toolbar" style={{ marginBottom: "1rem" }}>
        <input type="search" name="q" defaultValue={sp.q} placeholder="Order #, name, email, phone" style={{ maxWidth: 260 }} />
        <select name="status" defaultValue={sp.status ?? ""} style={{ maxWidth: 170 }}>
          <option value="">All statuses</option>
          <option value="open">To prepare</option>
          <option value="review">Needs review</option>
          <option value="paid">Paid</option>
          <option value="partially_refunded">Partly refunded</option>
          <option value="refunded">Refunded</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select name="method" defaultValue={sp.method ?? ""} style={{ maxWidth: 150 }}>
          <option value="">Any method</option>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
          <option value="shipping">Shipping</option>
        </select>
        <select name="source" defaultValue={sp.source ?? ""} style={{ maxWidth: 160 }}>
          <option value="">Any source</option>
          <option value="web">Website</option>
          <option value="subscription">Subscription renewal</option>
          <option value="manual">Recorded by hand</option>
          <option value="shopify">Shopify history</option>
        </select>
        <button className="btn btn-small" type="submit">
          Filter
        </button>
      </form>

      <form action={bulkFulfill}>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th aria-label="Select" />
                <th>Order</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Method</th>
                <th>Payment</th>
                <th>Fulfillment</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.fulfillmentStatus !== "fulfilled" && o.status !== "cancelled" ? (
                      <input type="checkbox" name="ids" value={o.id} aria-label={`Select order ${o.number}`} />
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/admin/orders/${o.id}`}>#{o.number}</Link>
                    {o.needsReview ? <span className="badge red" style={{ marginLeft: 4 }}>review</span> : null}
                    {o.source === "subscription" ? <span className="badge" style={{ marginLeft: 4 }}>renewal</span> : null}
                  </td>
                  <td>{formatDate(o.createdAt)}</td>
                  <td>{o.shipName || o.email || o.phone || "Guest"}</td>
                  <td className="small">{o.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}</td>
                  <td>{o.fulfillmentMethod}</td>
                  <td>
                    {statusBadge(o.status)} <span className="small muted">{o.paymentMethod}</span>
                  </td>
                  <td>
                    <span className={`badge ${o.fulfillmentStatus === "fulfilled" ? "green" : o.fulfillmentStatus === "ready" ? "" : "amber"}`}>
                      {o.fulfillmentStatus}
                    </span>
                  </td>
                  <td className="num">{formatCents(o.totalCents)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted">
                    No orders match. Try clearing the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="toolbar" style={{ marginTop: "0.75rem", justifyContent: "space-between" }}>
          <button className="btn btn-small btn-ghost" type="submit">
            Mark selected fulfilled
          </button>
          <span className="small muted">
            {total} orders.{" "}
            {page > 1 && <Link href={qs({ page: page - 1 })}>Previous</Link>}{" "}
            {page * PAGE < total && <Link href={qs({ page: page + 1 })}>Next</Link>}
          </span>
        </div>
      </form>
    </>
  );
}
