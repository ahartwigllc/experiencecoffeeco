import { and, desc, gte, lt } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDate, isRangeKey, localDateString, RANGE_LABELS, rangeBounds, type RangeKey } from "@/lib/dates";
import { EXPENSE_LABELS } from "@/lib/expense-categories";
import { formatCents } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { addExpense, deleteExpense } from "../../actions/finance";

const RANGES: RangeKey[] = ["month", "last_month", "ytd", "all"];

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ range?: string; ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const range: RangeKey = isRangeKey(sp.range) && RANGES.includes(sp.range) ? sp.range : "month";
  const { start, end } = rangeBounds(range);
  const settings = await getSettings();
  const list = await db()
    .select()
    .from(schema.expenses)
    .where(and(gte(schema.expenses.spentOn, localDateString(start)), lt(schema.expenses.spentOn, localDateString(end))))
    .orderBy(desc(schema.expenses.spentOn), desc(schema.expenses.id));
  const total = list.reduce((a, e) => a + e.amountCents, 0);

  return (
    <>
      <div className="admin-head">
        <h1>Expenses</h1>
        <div className="toolbar">
          {RANGES.map((r) => (
            <a key={r} className={`btn btn-small ${r === range ? "" : "btn-ghost"}`} href={`?range=${r}`}>
              {RANGE_LABELS[r]}
            </a>
          ))}
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted small">
        Record what the business spends so profit is real.{" "}
        {settings.cogsMethod === "unit_cost"
          ? "You're using unit costs for cost of goods, so green coffee, packaging, and ingredient purchases here are tracked for your records but not subtracted twice."
          : "You're counting green coffee, packaging, and ingredient purchases as cost of goods in the month you buy them."}
      </p>

      <form action={addExpense} className="card admin-form">
        <div className="row">
          <div className="field">
            <label htmlFor="spentOn">Date</label>
            <input id="spentOn" name="spentOn" type="date" defaultValue={localDateString()} required />
          </div>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue="green_coffee">
              {Object.entries(EXPENSE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Amount ($)</label>
            <input id="amount" name="amount" inputMode="decimal" required />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="vendor">Paid to</label>
            <input id="vendor" name="vendor" placeholder="Importer, Uline, Cloudflare…" />
          </div>
          <div className="field">
            <label htmlFor="description">What for</label>
            <input id="description" name="description" required placeholder="20 lb Peru Agua Colorada" />
          </div>
        </div>
        <div>
          <button className="btn btn-small" type="submit">
            Add expense
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Paid to</th>
              <th>What for</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(`${e.spentOn}T12:00:00Z`)}</td>
                <td>{EXPENSE_LABELS[e.category] ?? e.category}</td>
                <td>{e.vendor}</td>
                <td>{e.description}</td>
                <td className="num">{formatCents(e.amountCents)}</td>
                <td>
                  <form action={deleteExpense}>
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmButton message="Delete this expense?">Delete</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No expenses in this range.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="num">{formatCents(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
