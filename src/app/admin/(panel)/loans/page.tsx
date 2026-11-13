import { desc } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDate, localDateString } from "@/lib/dates";
import { getLoanSummary, paidPercent } from "@/lib/loans";
import { formatCents } from "@/lib/money";
import { addLoanEntry, deleteLoanEntry } from "../../actions/finance";

export default async function LoansPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const list = await db().select().from(schema.loanEntries).orderBy(desc(schema.loanEntries.entryOn), desc(schema.loanEntries.id));

  const lenders = await getLoanSummary();
  const owed = lenders.reduce((a, l) => a + l.owedCents, 0);
  const lastLender = list[0]?.lender ?? "";

  return (
    <>
      <div className="admin-head">
        <h1>Loans</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="muted small">
        Money lent to the business and what you&apos;ve paid back. Loans aren&apos;t income and repayments aren&apos;t expenses, so none of this changes
        profit or taxes.
      </p>

      <div className="card">
        <h2>Still owed: {formatCents(owed)}</h2>
        {lenders.length > 0 ? (
          <table className="data">
            <thead>
              <tr>
                <th>Lender</th>
                <th className="num">Borrowed</th>
                <th className="num">Paid back</th>
                <th className="num">Owed</th>
                <th className="num">Paid back this year</th>
                <th>Payoff</th>
              </tr>
            </thead>
            <tbody>
              {lenders.map((l) => (
                <tr key={l.lender}>
                  <td>{l.lender}</td>
                  <td className="num">{formatCents(l.borrowedCents)}</td>
                  <td className="num">{formatCents(l.repaidCents)}</td>
                  <td className="num">{formatCents(l.owedCents)}</td>
                  <td className="num">{formatCents(l.paidThisYearCents)}</td>
                  <td style={{ minWidth: 140 }}>
                    <div className="payoff">
                      <span style={{ width: `${paidPercent(l)}%` }} />
                    </div>
                    <span className="small muted">{paidPercent(l)}% paid</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <form action={addLoanEntry} className="card admin-form">
        <div className="row">
          <div className="field">
            <label htmlFor="entryOn">Date</label>
            <input id="entryOn" name="entryOn" type="date" defaultValue={localDateString()} required />
          </div>
          <div className="field">
            <label htmlFor="kind">Type</label>
            <select id="kind" name="kind" defaultValue="payment">
              <option value="draw">Money in (borrowed)</option>
              <option value="payment">Payment back</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Amount ($)</label>
            <input id="amount" name="amount" inputMode="decimal" required />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="lender">From</label>
            <input id="lender" name="lender" defaultValue={lastLender} placeholder="Ally Bank (4517)" required />
          </div>
          <div className="field">
            <label htmlFor="note">Note</label>
            <input id="note" name="note" />
          </div>
        </div>
        <div>
          <button className="btn btn-small" type="submit">
            Add entry
          </button>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Date</th>
              <th>Lender</th>
              <th>Type</th>
              <th>Note</th>
              <th className="num">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(`${e.entryOn}T12:00:00Z`)}</td>
                <td>{e.lender}</td>
                <td>{e.kind === "draw" ? "Borrowed" : "Paid back"}</td>
                <td>{e.note}</td>
                <td className={`num ${e.kind === "payment" ? "negative" : ""}`}>{e.kind === "payment" ? "−" : ""}{formatCents(e.amountCents)}</td>
                <td>
                  <form action={deleteLoanEntry}>
                    <input type="hidden" name="id" value={e.id} />
                    <ConfirmButton message="Delete this entry?">Delete</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No loan entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
