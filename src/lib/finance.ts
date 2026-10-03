import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { localDateString, monthKeysBetween, tz } from "./dates";
import { computePnl, EMPTY_PNL_INPUT, type Pnl, type PnlInput } from "./finance-math";
import type { Settings } from "./settings";

const COUNTED = sql`('paid','partially_refunded','refunded')`;
const COGS_CATEGORIES = sql`('green_coffee','packaging','ingredients')`;

type Row = Record<string, unknown>;
const n = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

async function rows(q: ReturnType<typeof sql>): Promise<Row[]> {
  const res = (await db().execute(q)) as unknown as { rows?: Row[] } | Row[];
  return Array.isArray(res) ? res : res.rows ?? [];
}

export type MonthPnl = { month: string; pnl: Pnl };
export type FinanceReport = {
  months: MonthPnl[];
  total: Pnl;
  missingCostUnits: number;
  pendingFeeOrders: number;
};

/**
 * Builds the profit-and-loss report for [start, end), bucketed by month in the
 * business timezone. See finance-math.ts for definitions.
 *
 * COGS method:
 *  - unit_cost: items sold x unit cost (variant cost snapshot at sale, falling back to the
 *    variant's current cost for imported history). Green coffee / packaging / ingredient
 *    purchases are treated as inventory and NOT also counted as expenses (no double counting).
 *  - purchases: COGS = those purchase expenses in the month bought; unit costs are ignored.
 */
export async function getFinanceReport(start: Date, end: Date, settings: Settings): Promise<FinanceReport> {
  const zone = tz();
  const s = start.toISOString();
  const e = end.toISOString();

  const [orderRows, cogsRows, laborRows, expenseRows] = await Promise.all([
    rows(sql`
      select to_char(created_at at time zone ${zone}, 'YYYY-MM') as month,
             count(*)::int as orders,
             coalesce(sum(subtotal_cents), 0) as gross,
             coalesce(sum(discount_cents), 0) as discounts,
             coalesce(sum(refunded_cents), 0) as refunded,
             coalesce(sum(shipping_cents), 0) as shipping,
             coalesce(sum(tax_cents), 0) as tax,
             coalesce(sum(fee_cents), 0) as fees,
             count(*) filter (where fee_cents is null and payment_method = 'stripe' and total_cents > 0)::int as pending_fees
      from orders
      where status in ${COUNTED} and created_at >= ${s}::timestamptz and created_at < ${e}::timestamptz
      group by 1`),
    rows(sql`
      select to_char(o.created_at at time zone ${zone}, 'YYYY-MM') as month,
             coalesce(sum(oi.quantity * coalesce(oi.unit_cost_cents, v.unit_cost_cents, 0)), 0) as cogs,
             coalesce(sum(case when coalesce(oi.unit_cost_cents, v.unit_cost_cents) is null then oi.quantity else 0 end), 0) as missing
      from order_items oi
      join orders o on o.id = oi.order_id
      left join variants v on v.id = oi.variant_id
      where o.status in ${COUNTED} and o.created_at >= ${s}::timestamptz and o.created_at < ${e}::timestamptz
      group by 1`),
    rows(sql`
      select to_char(clock_in at time zone ${zone}, 'YYYY-MM') as month,
             coalesce(sum(extract(epoch from (clock_out - clock_in)) / 3600.0), 0) as hours,
             coalesce(sum(extract(epoch from (clock_out - clock_in)) / 3600.0 * hourly_wage_cents), 0) as labor
      from time_entries
      where clock_out is not null and clock_in >= ${s}::timestamptz and clock_in < ${e}::timestamptz
      group by 1`),
    rows(sql`
      select to_char(spent_on, 'YYYY-MM') as month,
             coalesce(sum(amount_cents) filter (where category in ${COGS_CATEGORIES}), 0) as purchases,
             coalesce(sum(amount_cents) filter (where category not in ${COGS_CATEGORIES}), 0) as opex
      from expenses
      where spent_on >= ${localDateString(start)}::date and spent_on < ${localDateString(end)}::date
      group by 1`),
  ]);

  const byMonth = new Map<string, PnlInput>();
  const get = (m: string) => {
    if (!byMonth.has(m)) byMonth.set(m, { ...EMPTY_PNL_INPUT, incomeTaxReservePercent: settings.incomeTaxReservePercent });
    return byMonth.get(m)!;
  };
  let pendingFeeOrders = 0;
  let missingCostUnits = 0;

  for (const r of orderRows) {
    const p = get(String(r.month));
    p.orders += n(r.orders);
    p.grossCents += n(r.gross);
    p.discountCents += n(r.discounts);
    p.refundedCents += n(r.refunded);
    p.shippingCents += n(r.shipping);
    p.taxCents += n(r.tax);
    p.feeCents += n(r.fees);
    pendingFeeOrders += n(r.pending_fees);
  }
  if (settings.cogsMethod === "unit_cost") {
    for (const r of cogsRows) {
      get(String(r.month)).cogsCents += Math.round(n(r.cogs));
      missingCostUnits += n(r.missing);
    }
  }
  for (const r of laborRows) {
    const p = get(String(r.month));
    p.hoursWorked += n(r.hours);
    p.laborCents += Math.round(n(r.labor));
  }
  for (const r of expenseRows) {
    const p = get(String(r.month));
    p.expensesCents += n(r.opex);
    if (settings.cogsMethod === "purchases") p.cogsCents += n(r.purchases);
  }

  // Fill empty months so charts have a continuous axis (cap at 36 months).
  const keys = monthKeysBetween(start, end).slice(-36);
  const knownKeys = [...byMonth.keys()];
  const allKeys = start.getUTCFullYear() < 2001 ? [...new Set([...knownKeys])].sort() : [...new Set([...keys, ...knownKeys])].sort();

  const months = allKeys.map((k) => ({ month: k, pnl: computePnl(get(k)) }));
  const totalInput = months.reduce<PnlInput>(
    (acc, m) => ({
      orders: acc.orders + m.pnl.orders,
      grossCents: acc.grossCents + m.pnl.grossCents,
      discountCents: acc.discountCents + m.pnl.discountCents,
      refundedCents: acc.refundedCents + m.pnl.refundedCents,
      shippingCents: acc.shippingCents + m.pnl.shippingCents,
      taxCents: acc.taxCents + m.pnl.taxCents,
      feeCents: acc.feeCents + m.pnl.feeCents,
      cogsCents: acc.cogsCents + m.pnl.cogsCents,
      laborCents: acc.laborCents + m.pnl.laborCents,
      expensesCents: acc.expensesCents + m.pnl.expensesCents,
      hoursWorked: acc.hoursWorked + m.pnl.hoursWorked,
      incomeTaxReservePercent: settings.incomeTaxReservePercent,
    }),
    { ...EMPTY_PNL_INPUT, incomeTaxReservePercent: settings.incomeTaxReservePercent },
  );
  return { months, total: computePnl(totalInput), missingCostUnits, pendingFeeOrders };
}

export type ProductMargin = {
  title: string;
  units: number;
  revenueCents: number;
  cogsCents: number;
  missingCost: boolean;
};

export async function getProductMargins(start: Date, end: Date): Promise<ProductMargin[]> {
  const r = await rows(sql`
    select coalesce(p.title, oi.title) as title,
           sum(oi.quantity)::int as units,
           coalesce(sum(oi.total_cents), 0) as revenue,
           coalesce(sum(oi.quantity * coalesce(oi.unit_cost_cents, v.unit_cost_cents, 0)), 0) as cogs,
           bool_or(coalesce(oi.unit_cost_cents, v.unit_cost_cents) is null) as missing
    from order_items oi
    join orders o on o.id = oi.order_id
    left join variants v on v.id = oi.variant_id
    left join products p on p.id = coalesce(oi.product_id, v.product_id)
    where o.status in ${COUNTED} and o.created_at >= ${start.toISOString()}::timestamptz and o.created_at < ${end.toISOString()}::timestamptz
    group by 1
    order by revenue desc`);
  return r.map((x) => ({
    title: String(x.title),
    units: n(x.units),
    revenueCents: n(x.revenue),
    cogsCents: Math.round(n(x.cogs)),
    missingCost: Boolean(x.missing),
  }));
}

export type LaborRow = { staffId: number; name: string; hours: number; laborCents: number; shifts: number };

export async function getLaborByStaff(start: Date, end: Date): Promise<LaborRow[]> {
  const r = await rows(sql`
    select s.id as staff_id, s.name,
           count(t.id)::int as shifts,
           coalesce(sum(extract(epoch from (t.clock_out - t.clock_in)) / 3600.0), 0) as hours,
           coalesce(sum(extract(epoch from (t.clock_out - t.clock_in)) / 3600.0 * t.hourly_wage_cents), 0) as labor
    from staff s
    left join time_entries t on t.staff_id = s.id and t.clock_out is not null
      and t.clock_in >= ${start.toISOString()}::timestamptz and t.clock_in < ${end.toISOString()}::timestamptz
    group by s.id, s.name
    order by s.name`);
  return r.map((x) => ({
    staffId: n(x.staff_id),
    name: String(x.name),
    shifts: n(x.shifts),
    hours: n(x.hours),
    laborCents: Math.round(n(x.labor)),
  }));
}

export type ExpenseByCategory = { category: string; amountCents: number };

export async function getExpensesByCategory(start: Date, end: Date): Promise<ExpenseByCategory[]> {
  const r = await rows(sql`
    select category::text as category, coalesce(sum(amount_cents), 0) as amount
    from expenses
    where spent_on >= ${localDateString(start)}::date and spent_on < ${localDateString(end)}::date
    group by 1 order by 2 desc`);
  return r.map((x) => ({ category: String(x.category), amountCents: n(x.amount) }));
}
