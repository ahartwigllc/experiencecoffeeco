import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { customerName } from "@/lib/customers";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { stripeDashboardUrl } from "@/lib/stripe";
import { saveCustomer } from "../../../actions/customers";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const c = await db().query.customers.findFirst({ where: eq(schema.customers.id, Number(id)) });
  if (!c) notFound();
  const [orders, subs, subscriber] = await Promise.all([
    db().query.orders.findMany({ where: eq(schema.orders.customerId, c.id), with: { items: true }, orderBy: [desc(schema.orders.createdAt)] }),
    db().query.subscriptions.findMany({ where: eq(schema.subscriptions.customerId, c.id), with: { items: true } }),
    c.email ? db().query.subscribers.findFirst({ where: eq(schema.subscribers.email, c.email) }) : Promise.resolve(undefined),
  ]);
  const counted = orders.filter((o) => ["paid", "partially_refunded", "refunded"].includes(o.status));
  const spent = counted.reduce((a, o) => a + o.totalCents - o.refundedCents, 0);

  return (
    <>
      <div className="admin-head">
        <h1>{customerName(c)}</h1>
        <Link className="btn btn-small btn-ghost" href="/admin/customers">
          All customers
        </Link>
      </div>
      <Flash {...sp} />
      <div className="stats">
        <div className="stat"><div className="stat-label">Lifetime spend</div><div className="stat-value">{formatCents(spent)}</div></div>
        <div className="stat"><div className="stat-label">Orders</div><div className="stat-value">{counted.length}</div></div>
        <div className="stat"><div className="stat-label">Average order</div><div className="stat-value">{counted.length ? formatCents(Math.round(spent / counted.length)) : "—"}</div></div>
        <div className="stat"><div className="stat-label">Customer since</div><div className="stat-value" style={{ fontSize: "1.1rem" }}>{formatDate(c.createdAt)}</div></div>
      </div>

      <div className="grid-2">
        <div>
          <div className="card">
            <h2>Orders</h2>
            <table className="data">
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`}>#{o.number}</Link></td>
                    <td>{formatDate(o.createdAt)}</td>
                    <td className="small">{o.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}</td>
                    <td><span className="badge">{o.status}</span></td>
                    <td className="num">{formatCents(o.totalCents)}</td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td className="muted">No orders.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="card">
            <h2>Subscriptions</h2>
            {subs.length === 0 ? (
              <p className="muted">None.</p>
            ) : (
              <ul>
                {subs.map((s) => (
                  <li key={s.id}>
                    {s.interval}, <span className="badge">{s.status}</span> {s.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}
                  </li>
                ))}
              </ul>
            )}
            {c.stripeCustomerId && (
              <p className="small">
                <a href={stripeDashboardUrl(`customers/${c.stripeCustomerId}`)} target="_blank" rel="noopener">Open in Stripe</a>
              </p>
            )}
          </div>
        </div>
        <form action={saveCustomer} className="card admin-form">
          <h2>Profile</h2>
          <input type="hidden" name="id" value={c.id} />
          <div className="row">
            <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" defaultValue={c.firstName ?? ""} /></div>
            <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" defaultValue={c.lastName ?? ""} /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" defaultValue={c.email ?? ""} /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={c.phone ?? ""} /></div>
          </div>
          <div className="field"><label htmlFor="address1">Street</label><input id="address1" name="address1" defaultValue={c.address1 ?? ""} /></div>
          <div className="row">
            <div className="field"><label htmlFor="address2">Apt</label><input id="address2" name="address2" defaultValue={c.address2 ?? ""} /></div>
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" defaultValue={c.city ?? ""} /></div>
            <div className="field"><label htmlFor="state">State</label><input id="state" name="state" defaultValue={c.state ?? ""} /></div>
            <div className="field"><label htmlFor="zip">ZIP</label><input id="zip" name="zip" defaultValue={c.zip ?? ""} /></div>
          </div>
          <div className="field"><label htmlFor="note">Private note</label><textarea id="note" name="note" defaultValue={c.note ?? ""} /></div>
          <label className="check">
            <input type="checkbox" name="acceptsMarketing" defaultChecked={c.acceptsMarketing} /> Gets marketing email
          </label>
          <p className="small muted">
            Email list status: {subscriber ? subscriber.status : "not on the list"}. Turning this on doesn't add them to the list; they need to
            opt in themselves or be added in Email marketing with their permission.
          </p>
          <div><button className="btn btn-small" type="submit">Save</button></div>
        </form>
      </div>
    </>
  );
}
