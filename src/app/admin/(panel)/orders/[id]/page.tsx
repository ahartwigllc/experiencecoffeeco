import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { orderProfitCents } from "@/lib/finance-math";
import { centsToInput, formatCents } from "@/lib/money";
import { getOrderWithItems } from "@/lib/orders";
import { stripeDashboardUrl } from "@/lib/stripe";
import { cancelOrder, clearReview, refundOrder, resendConfirmation, saveNote, setFulfillment, updateOrderAddress } from "../../../actions/orders";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const order = await getOrderWithItems(Number(id));
  if (!order) notFound();

  const variantIds = order.items.map((i) => i.variantId).filter((x): x is number => !!x);
  const variants = variantIds.length ? await db().select().from(schema.variants).where(inArray(schema.variants.id, variantIds)) : [];
  const currentCost = new Map(variants.map((v) => [v.id, v.unitCostCents]));
  const cost = (i: (typeof order.items)[number]) => i.unitCostCents ?? (i.variantId ? currentCost.get(i.variantId) ?? null : null);
  const cogs = order.items.reduce((a, i) => a + (cost(i) ?? 0) * i.quantity, 0);
  const missingCost = order.items.some((i) => cost(i) === null);
  const profit = orderProfitCents({ ...order, cogsCents: cogs });
  const remaining = order.totalCents - order.refundedCents;
  const sub = order.stripeSubscriptionId
    ? await db().query.subscriptions.findFirst({ where: eq(schema.subscriptions.stripeSubscriptionId, order.stripeSubscriptionId) })
    : null;

  return (
    <>
      <div className="admin-head">
        <h1>
          Order #{order.number}{" "}
          <span className="badge">{order.status.replace("_", " ")}</span>{" "}
          <span className={`badge ${order.fulfillmentStatus === "fulfilled" ? "green" : "amber"}`}>{order.fulfillmentStatus}</span>
        </h1>
        <Link href="/admin/orders" className="btn btn-small btn-ghost">
          All orders
        </Link>
      </div>
      <Flash {...sp} />
      {order.needsReview && (
        <div className="flash error">
          <strong>Needs review.</strong> {order.reviewReason}
          <form action={clearReview} style={{ display: "inline", marginLeft: 8 }}>
            <input type="hidden" name="id" value={order.id} />
            <button className="link-button" type="submit">
              Mark reviewed
            </button>
          </form>
        </div>
      )}

      <div className="grid-2">
        <div>
          <div className="card">
            <h2>Items</h2>
            <table className="data">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th className="num">Price</th>
                  <th className="num">Unit cost</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.title}
                      <div className="small muted">
                        {i.variantTitle}
                        {i.subscriptionInterval ? ` (subscription: ${i.subscriptionInterval})` : ""}
                      </div>
                    </td>
                    <td className="num">{i.quantity}</td>
                    <td className="num">{formatCents(i.unitPriceCents)}</td>
                    <td className="num">{cost(i) === null ? <span className="badge amber">not set</span> : formatCents(cost(i))}</td>
                    <td className="num">{formatCents(i.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Subtotal</td>
                  <td className="num">{formatCents(order.subtotalCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="card">
            <h2>Money</h2>
            <table className="data">
              <tbody>
                <tr><td>Subtotal</td><td className="num">{formatCents(order.subtotalCents)}</td></tr>
                <tr><td>Discounts {order.discountCodes.length ? `(${order.discountCodes.join(", ")})` : ""}</td><td className="num">−{formatCents(order.discountCents)}</td></tr>
                <tr><td>Delivery / shipping</td><td className="num">{formatCents(order.shippingCents)}</td></tr>
                <tr><td>Sales tax collected</td><td className="num">{formatCents(order.taxCents)}</td></tr>
                <tr><td><strong>Customer paid</strong></td><td className="num"><strong>{formatCents(order.totalCents)}</strong></td></tr>
                <tr><td>Refunded</td><td className="num">{order.refundedCents ? `−${formatCents(order.refundedCents)}` : formatCents(0)}</td></tr>
                <tr><td>Payment fee ({order.paymentMethod})</td><td className="num">{order.feeCents === null ? <span className="badge amber">pending</span> : `−${formatCents(order.feeCents)}`}</td></tr>
                <tr><td>Cost of goods{missingCost ? " (some costs missing)" : ""}</td><td className="num">−{formatCents(cogs)}</td></tr>
                <tr><td><strong>Profit on this order</strong></td><td className={`num ${profit < 0 ? "negative" : "positive"}`}><strong>{formatCents(profit)}</strong></td></tr>
              </tbody>
            </table>
            <p className="small muted">Profit here excludes labor and overhead, which are counted on the Profit and taxes page.</p>
          </div>

          {order.status !== "cancelled" && remaining > 0 && (
            <div className="card">
              <h2>Refund</h2>
              <form action={refundOrder} className="admin-form">
                <input type="hidden" name="id" value={order.id} />
                <div className="row">
                  <div className="field">
                    <label htmlFor="amount">Amount (up to {formatCents(remaining)})</label>
                    <input id="amount" name="amount" type="text" inputMode="decimal" defaultValue={centsToInput(remaining)} />
                  </div>
                </div>
                <label className="check">
                  <input type="checkbox" name="restock" /> Put the items back in stock
                </label>
                <div>
                  <ConfirmButton className="btn btn-small" message="Refund this amount? This can't be undone.">
                    {order.paymentMethod === "stripe" ? "Refund through Stripe" : "Record refund"}
                  </ConfirmButton>
                </div>
              </form>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <h2>Fulfillment</h2>
            <p>
              <strong>{order.fulfillmentMethod === "pickup" ? "Pickup" : order.fulfillmentMethod === "delivery" ? "Local delivery" : "Shipping"}</strong>
              {order.readyAt ? <span className="small muted"> Ready {formatDateTime(order.readyAt)}.</span> : null}
              {order.fulfilledAt ? <span className="small muted"> Fulfilled {formatDateTime(order.fulfilledAt)}.</span> : null}
            </p>
            <div className="toolbar">
              {order.fulfillmentStatus !== "ready" && order.fulfillmentStatus !== "fulfilled" && (
                <form action={setFulfillment} className="toolbar">
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="ready" />
                  <label className="check small">
                    <input type="checkbox" name="notify" defaultChecked={Boolean(order.email)} /> Email customer
                  </label>
                  <button className="btn btn-small" type="submit">
                    {order.fulfillmentMethod === "pickup" ? "Ready for pickup" : "Out for delivery"}
                  </button>
                </form>
              )}
              {order.fulfillmentStatus !== "fulfilled" ? (
                <form action={setFulfillment}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="fulfilled" />
                  <button className="btn btn-small btn-cherry" type="submit">
                    Mark fulfilled
                  </button>
                </form>
              ) : (
                <form action={setFulfillment}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value="unfulfilled" />
                  <button className="btn btn-small btn-ghost" type="submit">
                    Undo fulfilled
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Customer</h2>
            <p>
              {order.customer ? <Link href={`/admin/customers/${order.customer.id}`}>{order.shipName || order.email}</Link> : order.shipName || "Guest"}
              <br />
              {order.email ? <a href={`mailto:${order.email}`}>{order.email}</a> : null}
              {order.phone ? (
                <>
                  <br />
                  <a href={`tel:${order.phone}`}>{order.phone}</a>
                </>
              ) : null}
            </p>
            {order.fulfillmentMethod !== "pickup" && (
              <details>
                <summary>
                  {[order.address1, order.address2, order.city, order.state, order.zip].filter(Boolean).join(", ") || "No address"} (edit)
                </summary>
                <form action={updateOrderAddress} className="admin-form" style={{ marginTop: "0.75rem" }}>
                  <input type="hidden" name="id" value={order.id} />
                  <input name="shipName" defaultValue={order.shipName ?? ""} placeholder="Name" />
                  <input name="phone" defaultValue={order.phone ?? ""} placeholder="Phone" />
                  <input name="address1" defaultValue={order.address1 ?? ""} placeholder="Street" />
                  <input name="address2" defaultValue={order.address2 ?? ""} placeholder="Apt / unit" />
                  <div className="row">
                    <input name="city" defaultValue={order.city ?? ""} placeholder="City" />
                    <input name="state" defaultValue={order.state ?? ""} placeholder="State" />
                    <input name="zip" defaultValue={order.zip ?? ""} placeholder="ZIP" />
                  </div>
                  <div>
                    <button className="btn btn-small" type="submit">
                      Save address
                    </button>
                  </div>
                </form>
              </details>
            )}
            {order.fulfillmentMethod !== "pickup" && order.address1 && (
              <p>
                <a
                  target="_blank"
                  rel="noopener"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent([order.address1, order.city, order.state, order.zip].filter(Boolean).join(", "))}`}
                >
                  Directions
                </a>
              </p>
            )}
          </div>

          <div className="card">
            <h2>Details</h2>
            <table className="data">
              <tbody>
                <tr><td>Placed</td><td>{formatDateTime(order.createdAt)}</td></tr>
                <tr><td>Source</td><td>{order.source}</td></tr>
                {sub ? <tr><td>Subscription</td><td><Link href="/admin/subscriptions">{sub.interval}, {sub.status}</Link></td></tr> : null}
                {order.stripePaymentIntentId ? (
                  <tr><td>Stripe</td><td><a href={stripeDashboardUrl(`payments/${order.stripePaymentIntentId}`)} target="_blank" rel="noopener">Open payment</a></td></tr>
                ) : null}
                {order.shopifyId ? <tr><td>Shopify id</td><td className="small">{order.shopifyId}</td></tr> : null}
              </tbody>
            </table>
            <div className="toolbar" style={{ marginTop: "0.75rem" }}>
              {order.email && (
                <form action={resendConfirmation}>
                  <input type="hidden" name="id" value={order.id} />
                  <button className="btn btn-small btn-ghost" type="submit">Resend confirmation</button>
                </form>
              )}
              {order.status !== "cancelled" && (
                <form action={cancelOrder} className="toolbar">
                  <input type="hidden" name="id" value={order.id} />
                  <label className="check small"><input type="checkbox" name="restock" defaultChecked /> Restock</label>
                  <ConfirmButton message="Cancel this order?">Cancel order</ConfirmButton>
                </form>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Private note</h2>
            <form action={saveNote} className="admin-form">
              <input type="hidden" name="id" value={order.id} />
              <textarea name="note" defaultValue={order.note ?? ""} placeholder="Only visible to you" />
              <div>
                <button className="btn btn-small" type="submit">Save note</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
