import { desc } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { createCoupon, publishCoupon, refreshCouponUsage, toggleCoupon } from "../../actions/coupons";

export default async function CouponsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const coupons = await db().select().from(schema.coupons).orderBy(desc(schema.coupons.createdAt));
  const usage = await db().select({ codes: schema.orders.discountCodes, discount: schema.orders.discountCents }).from(schema.orders);
  const stats = new Map<string, { uses: number; given: number }>();
  for (const u of usage)
    for (const code of u.codes) {
      const s = stats.get(code) ?? { uses: 0, given: 0 };
      s.uses++;
      s.given += u.codes.length === 1 ? u.discount : 0;
      stats.set(code, s);
    }

  return (
    <>
      <div className="admin-head">
        <h1>Coupons</h1>
        <form action={refreshCouponUsage}>
          <button className="btn btn-small btn-ghost" type="submit">Refresh usage</button>
        </form>
      </div>
      <Flash {...sp} />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Applies</th>
              <th>Limits</th>
              <th className="num">Orders</th>
              <th className="num">Given away</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                  {c.description ? <div className="small muted">{c.description}</div> : null}
                </td>
                <td>{c.percentOff ? `${c.percentOff}% off` : `${formatCents(c.amountOffCents)} off`}</td>
                <td className="small">{c.duration === "once" ? "One order (first payment of a subscription)" : c.duration === "forever" ? "Every order, including renewals" : `First ${c.durationInMonths} month(s) of renewals`}</td>
                <td className="small">
                  {[c.maxRedemptions ? `${c.maxRedemptions} uses max` : null, c.firstTimeOnly ? "first order only" : null, c.minimumCents ? `min ${formatCents(c.minimumCents)}` : null, c.expiresAt ? `ends ${formatDate(c.expiresAt)}` : null]
                    .filter(Boolean)
                    .join(", ") || "None"}
                </td>
                <td className="num">{stats.get(c.code)?.uses ?? 0}</td>
                <td className="num">{formatCents(stats.get(c.code)?.given ?? 0)}</td>
                <td>
                  {!c.stripePromotionCodeId ? <span className="badge amber">not in Stripe</span> : c.active ? <span className="badge green">on</span> : <span className="badge">off</span>}
                </td>
                <td>
                  <div className="toolbar">
                    {!c.stripePromotionCodeId && (
                      <form action={publishCoupon}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn-small" type="submit">Publish</button>
                      </form>
                    )}
                    <form action={toggleCoupon}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-small btn-ghost" type="submit">{c.active ? "Turn off" : "Turn on"}</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && <tr><td colSpan={8} className="muted">No coupons yet. Create one below.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Create a coupon</h2>
      <form action={createCoupon} className="card admin-form">
        <div className="row">
          <div className="field"><label htmlFor="code">Code customers type</label><input id="code" name="code" required placeholder="WELCOME10" style={{ textTransform: "uppercase" }} /></div>
          <div className="field"><label htmlFor="description">Internal note</label><input id="description" name="description" placeholder="Farmers market flyer" /></div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" name="type" defaultValue="percent">
              <option value="percent">Percent off</option>
              <option value="amount">Dollar amount off</option>
            </select>
          </div>
          <div className="field"><label htmlFor="percent">Percent off</label><input id="percent" name="percent" type="number" min={1} max={100} placeholder="10" /></div>
          <div className="field"><label htmlFor="amount">or dollars off</label><input id="amount" name="amount" inputMode="decimal" placeholder="5.00" /></div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="duration">On subscriptions, applies to</label>
            <select id="duration" name="duration" defaultValue="once">
              <option value="once">First payment only</option>
              <option value="repeating">First few months</option>
              <option value="forever">Every renewal</option>
            </select>
          </div>
          <div className="field"><label htmlFor="months">Months (if "first few")</label><input id="months" name="months" type="number" min={1} defaultValue={3} /></div>
        </div>
        <div className="row">
          <div className="field"><label htmlFor="maxRedemptions">Total uses allowed</label><input id="maxRedemptions" name="maxRedemptions" type="number" min={1} placeholder="unlimited" /></div>
          <div className="field"><label htmlFor="minimum">Minimum order ($)</label><input id="minimum" name="minimum" inputMode="decimal" /></div>
          <div className="field"><label htmlFor="expiresAt">Ends</label><input id="expiresAt" name="expiresAt" type="datetime-local" /></div>
        </div>
        <label className="check"><input type="checkbox" name="firstTimeOnly" /> Only for a customer's first order</label>
        <div><button className="btn" type="submit">Create coupon</button></div>
      </form>
    </>
  );
}
