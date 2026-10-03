import { BarChart } from "@/components/admin/BarChart";
import { Flash } from "@/components/admin/Flash";
import { requireOwner } from "@/lib/auth";
import { isRangeKey, monthLabel, RANGE_LABELS, rangeBounds, type RangeKey } from "@/lib/dates";
import { EXPENSE_LABELS } from "@/lib/expense-categories";
import { getExpensesByCategory, getFinanceReport, getProductMargins } from "@/lib/finance";
import { formatCents, percent } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { fetchMissingFees } from "../../actions/finance";

const RANGES: RangeKey[] = ["month", "last_month", "ytd", "last_12", "all"];

function Line({ label, cents, strong, negative, hint }: { label: string; cents: number; strong?: boolean; negative?: boolean; hint?: string }) {
  const v = negative ? -cents : cents;
  return (
    <tr>
      <td style={{ paddingLeft: strong ? undefined : "1.25rem" }}>
        {strong ? <strong>{label}</strong> : label}
        {hint ? <div className="small muted">{hint}</div> : null}
      </td>
      <td className={`num ${v < 0 && strong ? "negative" : ""}`}>{strong ? <strong>{formatCents(v)}</strong> : formatCents(v)}</td>
    </tr>
  );
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ range?: string; ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const range: RangeKey = isRangeKey(sp.range) && RANGES.includes(sp.range) ? sp.range : "month";
  const { start, end } = rangeBounds(range);
  const settings = await getSettings();
  const [report, products, categories] = await Promise.all([
    getFinanceReport(start, end, settings),
    getProductMargins(start, end),
    getExpensesByCategory(start, end),
  ]);
  const t = report.total;

  return (
    <>
      <div className="admin-head">
        <h1>Profit and taxes</h1>
        <div className="toolbar">
          {RANGES.map((r) => (
            <a key={r} className={`btn btn-small ${r === range ? "" : "btn-ghost"}`} href={`?range=${r}`}>
              {RANGE_LABELS[r]}
            </a>
          ))}
          <a className="btn btn-small btn-ghost" href={`/admin/finance/export?range=${range}`}>
            Export CSV
          </a>
        </div>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      {(report.missingCostUnits > 0 || report.pendingFeeOrders > 0) && (
        <div className="flash error">
          {report.missingCostUnits > 0 && (
            <div>
              {report.missingCostUnits} items sold have no unit cost, so cost of goods is understated and profit looks higher than it is.{" "}
              <a href="/admin/products">Add costs on Products.</a>
            </div>
          )}
          {report.pendingFeeOrders > 0 && (
            <form action={fetchMissingFees} style={{ display: "inline" }}>
              {report.pendingFeeOrders} card payments don't have their Stripe fee yet.{" "}
              <button className="link-button" type="submit">
                Fetch fees now
              </button>
            </form>
          )}
        </div>
      )}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Revenue</div>
          <div className="stat-value">{formatCents(t.revenueCents)}</div>
          <div className="stat-sub">{t.orders} orders, avg {formatCents(t.averageOrderCents)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Net profit</div>
          <div className={`stat-value ${t.netProfitCents < 0 ? "negative" : ""}`}>{formatCents(t.netProfitCents)}</div>
          <div className="stat-sub">{percent(t.netMargin)} margin</div>
        </div>
        <div className="stat">
          <div className="stat-label">Profit per hour</div>
          <div className="stat-value">{t.profitPerHourCents === null ? "—" : formatCents(t.profitPerHourCents)}</div>
          <div className="stat-sub">{t.hoursWorked.toFixed(1)} hours logged</div>
        </div>
        <div className="stat">
          <div className="stat-label">Revenue per hour</div>
          <div className="stat-value">{t.revenuePerHourCents === null ? "—" : formatCents(t.revenuePerHourCents)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Sales tax collected</div>
          <div className="stat-value">{formatCents(t.taxCents)}</div>
          <div className="stat-sub">owed to the state, not yours</div>
        </div>
        <div className="stat">
          <div className="stat-label">Set aside for income tax</div>
          <div className="stat-value">{formatCents(t.incomeTaxReserveCents)}</div>
          <div className="stat-sub">{settings.incomeTaxReservePercent}% of profit (estimate)</div>
        </div>
      </div>

      <div className="card">
        <h2>By month</h2>
        <BarChart data={report.months.map((m) => ({ label: monthLabel(m.month), revenue: m.pnl.revenueCents, profit: m.pnl.netProfitCents }))} />
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Profit and loss, {RANGE_LABELS[range].toLowerCase()}</h2>
          <table className="data">
            <tbody>
              <Line label="Gross sales" cents={t.grossCents} />
              <Line label="Discounts" cents={t.discountCents} negative />
              <Line label="Refunds" cents={t.refundedCents} negative />
              <Line label="Net sales" cents={t.netSalesCents} strong />
              <Line label="Delivery and shipping charged" cents={t.shippingCents} />
              <Line label="Revenue" cents={t.revenueCents} strong hint="Sales tax is excluded; it belongs to the state." />
              <Line label="Payment processing fees" cents={t.feeCents} negative />
              <Line
                label="Cost of goods sold"
                cents={t.cogsCents}
                negative
                hint={settings.cogsMethod === "unit_cost" ? "Items sold × unit cost" : "Green coffee, packaging, and ingredient purchases"}
              />
              <Line label="Gross profit" cents={t.grossProfitCents} strong />
              <Line label="Labor" cents={t.laborCents} negative hint={`${t.hoursWorked.toFixed(1)} hours from the time clock`} />
              <Line label="Operating expenses" cents={t.expensesCents} negative />
              <Line label="Net profit" cents={t.netProfitCents} strong />
              <Line label={`Income tax set-aside (${settings.incomeTaxReservePercent}%)`} cents={t.incomeTaxReserveCents} negative />
              <Line label="Yours to keep (estimate)" cents={t.takeHomeCents} strong />
            </tbody>
          </table>
        </div>

        <div>
          <div className="card">
            <h2>Taxes</h2>
            <p>
              <strong>Sales tax.</strong>{" "}
              {settings.taxMode === "none"
                ? "Checkout isn't charging sales tax, which matches how the Shopify store ran. In New Jersey, coffee beans and other grocery food are generally exempt, but confirm with your accountant, especially for the cold brew box."
                : "Stripe Tax calculates sales tax at checkout. File and pay it from the Stripe Tax reports or with your accountant."}{" "}
              Collected in this range: <strong>{formatCents(t.taxCents)}</strong>.
            </p>
            <p>
              <strong>Income tax.</strong> Federal estimated payments for self-employed income are usually due April 15, June 15,
              September 15, and January 15. The set-aside above is a rough guide, not tax advice. Change the percentage in Settings.
            </p>
            <p className="small muted">This page isn't a substitute for an accountant. Export the CSV and send it to yours.</p>
          </div>

          <div className="card">
            <h2>Expenses by category</h2>
            <table className="data">
              <tbody>
                {categories.map((c) => (
                  <tr key={c.category}>
                    <td>
                      {EXPENSE_LABELS[c.category] ?? c.category}
                      {settings.cogsMethod === "unit_cost" && ["green_coffee", "packaging", "ingredients"].includes(c.category) ? (
                        <div className="small muted">Inventory purchase, counted through unit costs instead</div>
                      ) : null}
                    </td>
                    <td className="num">{formatCents(c.amountCents)}</td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td className="muted">
                      No expenses recorded. <a href="/admin/expenses">Add them</a> to see true profit.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2>Month by month</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Month</th>
              <th className="num">Orders</th>
              <th className="num">Revenue</th>
              <th className="num">Fees</th>
              <th className="num">Cost of goods</th>
              <th className="num">Labor</th>
              <th className="num">Expenses</th>
              <th className="num">Net profit</th>
              <th className="num">Hours</th>
              <th className="num">Profit / hour</th>
              <th className="num">Sales tax</th>
            </tr>
          </thead>
          <tbody>
            {report.months
              .slice()
              .reverse()
              .map((m) => (
                <tr key={m.month}>
                  <td>{monthLabel(m.month)}</td>
                  <td className="num">{m.pnl.orders}</td>
                  <td className="num">{formatCents(m.pnl.revenueCents)}</td>
                  <td className="num">{formatCents(m.pnl.feeCents)}</td>
                  <td className="num">{formatCents(m.pnl.cogsCents)}</td>
                  <td className="num">{formatCents(m.pnl.laborCents)}</td>
                  <td className="num">{formatCents(m.pnl.expensesCents)}</td>
                  <td className={`num ${m.pnl.netProfitCents < 0 ? "negative" : ""}`}>{formatCents(m.pnl.netProfitCents)}</td>
                  <td className="num">{m.pnl.hoursWorked.toFixed(1)}</td>
                  <td className="num">{m.pnl.profitPerHourCents === null ? "—" : formatCents(m.pnl.profitPerHourCents)}</td>
                  <td className="num">{formatCents(m.pnl.taxCents)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="num">{t.orders}</td>
              <td className="num">{formatCents(t.revenueCents)}</td>
              <td className="num">{formatCents(t.feeCents)}</td>
              <td className="num">{formatCents(t.cogsCents)}</td>
              <td className="num">{formatCents(t.laborCents)}</td>
              <td className="num">{formatCents(t.expensesCents)}</td>
              <td className="num">{formatCents(t.netProfitCents)}</td>
              <td className="num">{t.hoursWorked.toFixed(1)}</td>
              <td className="num">{t.profitPerHourCents === null ? "—" : formatCents(t.profitPerHourCents)}</td>
              <td className="num">{formatCents(t.taxCents)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h2>Which coffees make money</h2>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th className="num">Units</th>
              <th className="num">Sales</th>
              <th className="num">Cost of goods</th>
              <th className="num">Gross profit</th>
              <th className="num">Margin</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.title}>
                <td>
                  {p.title}
                  {p.missingCost ? <span className="badge amber" style={{ marginLeft: 6 }}>cost missing</span> : null}
                </td>
                <td className="num">{p.units}</td>
                <td className="num">{formatCents(p.revenueCents)}</td>
                <td className="num">{formatCents(p.cogsCents)}</td>
                <td className="num">{formatCents(p.revenueCents - p.cogsCents)}</td>
                <td className="num">{p.revenueCents > 0 ? percent((p.revenueCents - p.cogsCents) / p.revenueCents, 0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
