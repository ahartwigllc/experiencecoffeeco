import { asc, eq } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { variantLabel } from "@/lib/catalog-utils";
import { formatCents } from "@/lib/money";
import { createManualOrder } from "../../../actions/orders";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireOwner();
  const { error } = await searchParams;
  const rows = await db()
    .select({ v: schema.variants, p: schema.products })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.products.id, schema.variants.productId))
    .orderBy(asc(schema.products.title), asc(schema.variants.position));

  const options = rows
    .filter((r) => r.p.status !== "archived" || r.v.active)
    .map((r) => ({ id: r.v.id, label: `${r.p.title}${variantLabel(r.v) ? `, ${variantLabel(r.v)}` : ""} (${formatCents(r.v.priceCents)})` }));

  return (
    <>
      <div className="admin-head">
        <h1>Record an order</h1>
      </div>
      <p className="muted">For sales outside the website: cash, Venmo, a market stand, or coffee you gave away. It counts toward revenue, inventory, and profit.</p>
      <Flash error={error} />
      <form action={createManualOrder} className="admin-form" style={{ maxWidth: 900 }}>
        <div className="card">
          <h2>Items</h2>
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price each (blank = list price)</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <select name={`variant_${i}`} defaultValue="" aria-label={`Item ${i + 1}`}>
                      <option value="">—</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ width: 90 }}>
                    <input name={`qty_${i}`} type="number" min={1} defaultValue={i === 0 ? 1 : undefined} aria-label="Quantity" />
                  </td>
                  <td style={{ width: 180 }}>
                    <input name={`price_${i}`} inputMode="decimal" placeholder="e.g. 0 for free" aria-label="Price each" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Customer</h2>
          <div className="row">
            <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="address1">Street (for delivery)</label><input id="address1" name="address1" /></div>
            <div className="field"><label htmlFor="city">City</label><input id="city" name="city" /></div>
            <div className="field"><label htmlFor="state">State</label><input id="state" name="state" defaultValue="NJ" /></div>
            <div className="field"><label htmlFor="zip">ZIP</label><input id="zip" name="zip" /></div>
          </div>
        </div>

        <div className="card">
          <h2>Payment</h2>
          <div className="row">
            <div className="field">
              <label htmlFor="paymentMethod">Paid by</label>
              <select id="paymentMethod" name="paymentMethod" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="venmo">Venmo</option>
                <option value="zelle">Zelle</option>
                <option value="cashapp">Cash App</option>
                <option value="card_reader">Card reader</option>
                <option value="comp">Free / comped</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="method">Fulfillment</label>
              <select id="method" name="method" defaultValue="pickup">
                <option value="pickup">Pickup / in person</option>
                <option value="delivery">Local delivery</option>
                <option value="shipping">Shipping</option>
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="discount">Discount ($)</label><input id="discount" name="discount" inputMode="decimal" /></div>
            <div className="field"><label htmlFor="shipping">Delivery fee ($)</label><input id="shipping" name="shipping" inputMode="decimal" /></div>
            <div className="field"><label htmlFor="tax">Sales tax ($)</label><input id="tax" name="tax" inputMode="decimal" /></div>
            <div className="field"><label htmlFor="fee">Processing fee ($)</label><input id="fee" name="fee" inputMode="decimal" /></div>
          </div>
          <div className="field"><label htmlFor="note">Note</label><textarea id="note" name="note" /></div>
          <label className="check"><input type="checkbox" name="decrement" defaultChecked /> Take items out of inventory</label>
          <label className="check"><input type="checkbox" name="fulfilled" defaultChecked /> Already handed over</label>
          <label className="check"><input type="checkbox" name="sendReceipt" /> Email the customer a receipt</label>
        </div>
        <div>
          <button className="btn" type="submit">Record order</button>
        </div>
      </form>
    </>
  );
}
