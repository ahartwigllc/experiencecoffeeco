import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { getCurrentStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { localDateString } from "@/lib/dates";

export async function GET() {
  const me = await getCurrentStaff();
  if (!me || me.role !== "owner") return new Response("Forbidden", { status: 403 });
  const res = (await db().execute(sql`
    select c.first_name, c.last_name, c.email, c.phone, c.address1, c.address2, c.city, c.state, c.zip, c.accepts_marketing, c.created_at,
           count(o.id) filter (where o.status in ('paid','partially_refunded','refunded'))::int as orders,
           coalesce(sum(o.total_cents - o.refunded_cents) filter (where o.status in ('paid','partially_refunded','refunded')), 0)::int as spent
    from customers c left join orders o on o.customer_id = c.id
    group by c.id order by c.created_at`)) as unknown as { rows: Record<string, unknown>[] };
  const rows = res.rows ?? [];
  const body = toCsv(
    ["first_name", "last_name", "email", "phone", "address1", "address2", "city", "state", "zip", "accepts_marketing", "created_at", "orders", "total_spent"],
    rows.map((r) => [r.first_name, r.last_name, r.email, r.phone, r.address1, r.address2, r.city, r.state, r.zip, r.accepts_marketing, r.created_at, r.orders, (Number(r.spent) / 100).toFixed(2)]),
  );
  return csvResponse(`customers-${localDateString()}.csv`, body);
}
