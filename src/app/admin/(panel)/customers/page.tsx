import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";

type Row = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  accepts_marketing: boolean;
  orders: number;
  spent: number;
  last_order: string | null;
  active_subs: number;
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  await requireOwner();
  const { q, sort } = await searchParams;
  const term = q?.trim() ? `%${q.trim()}%` : null;
  const order =
    sort === "spent" ? sql`spent desc` : sort === "orders" ? sql`orders desc` : sort === "name" ? sql`c.first_name asc nulls last` : sql`last_order desc nulls last`;
  const res = (await db().execute(sql`
    select c.id, c.first_name, c.last_name, c.email, c.phone, c.accepts_marketing,
           count(o.id) filter (where o.status in ('paid','partially_refunded','refunded'))::int as orders,
           coalesce(sum(o.total_cents - o.refunded_cents) filter (where o.status in ('paid','partially_refunded','refunded')), 0)::int as spent,
           max(o.created_at) as last_order,
           (select count(*)::int from subscriptions s where s.customer_id = c.id and s.status in ('active','trialing','past_due')) as active_subs
    from customers c
    left join orders o on o.customer_id = c.id
    ${term ? sql`where c.email ilike ${term} or c.first_name ilike ${term} or c.last_name ilike ${term} or c.phone ilike ${term}` : sql``}
    group by c.id
    order by ${order}
    limit 500`)) as unknown as { rows: Row[] };
  const rows = res.rows ?? [];

  return (
    <>
      <div className="admin-head">
        <h1>Customers</h1>
        <a className="btn btn-small btn-ghost" href="/admin/customers/export">
          Export CSV
        </a>
      </div>
      <form className="toolbar" style={{ marginBottom: "1rem" }}>
        <input type="search" name="q" defaultValue={q} placeholder="Name, email, or phone" style={{ maxWidth: 280 }} />
        <select name="sort" defaultValue={sort ?? ""} style={{ maxWidth: 200 }}>
          <option value="">Most recent order</option>
          <option value="spent">Most spent</option>
          <option value="orders">Most orders</option>
          <option value="name">Name</option>
        </select>
        <button className="btn btn-small" type="submit">
          Search
        </button>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Contact</th>
              <th className="num">Orders</th>
              <th className="num">Spent</th>
              <th>Last order</th>
              <th>Email list</th>
              <th>Subscriber</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/customers/${c.id}`}>{[c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || c.phone || `#${c.id}`}</Link>
                </td>
                <td className="small">
                  {c.email}
                  {c.phone ? <div className="muted">{c.phone}</div> : null}
                </td>
                <td className="num">{c.orders}</td>
                <td className="num">{formatCents(c.spent)}</td>
                <td>{c.last_order ? formatDate(c.last_order) : "—"}</td>
                <td>{c.accepts_marketing ? <span className="badge green">yes</span> : <span className="badge">no</span>}</td>
                <td>{c.active_subs ? <span className="badge green">{c.active_subs} active</span> : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
