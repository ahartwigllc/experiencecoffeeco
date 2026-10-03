"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCents } from "@/lib/money";
import { INTERVALS, isDeliveryZip, validateCartShape, type Interval } from "@/lib/pricing";
import { lineKey, useCart } from "./CartProvider";

export type FulfillmentOptions = {
  pickupEnabled: boolean;
  pickupAddress: string;
  pickupInstructions: string;
  deliveryEnabled: boolean;
  deliveryZips: string[];
  deliveryFeeCents: number;
  deliveryMinimumCents: number;
  deliveryNote: string;
  shippingEnabled: boolean;
  shippingFlatCents: number;
  freeShippingOverCents: number;
  intervals: Interval[];
};

type Method = "pickup" | "delivery" | "shipping";

export function CartView({ options }: { options: FulfillmentOptions }) {
  const cart = useCart();
  const firstMethod: Method = options.pickupEnabled ? "pickup" : options.deliveryEnabled ? "delivery" : "shipping";
  const [method, setMethod] = useState<Method>(firstMethod);
  const [zip, setZip] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const subtotal = useMemo(() => cart.lines.reduce((a, l) => a + l.unitPriceCents * l.quantity, 0), [cart.lines]);
  const shape = validateCartShape(cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, interval: l.interval })));
  const hasSub = cart.lines.some((l) => l.interval);

  let fee = 0;
  let feeLabel = "";
  if (method === "delivery") {
    fee = options.deliveryFeeCents;
    feeLabel = "Delivery";
  } else if (method === "shipping") {
    fee = options.freeShippingOverCents && subtotal >= options.freeShippingOverCents ? 0 : options.shippingFlatCents;
    feeLabel = "Shipping";
  }

  const zipOk = method !== "delivery" || isDeliveryZip(zip, options.deliveryZips);
  const minOk = method !== "delivery" || !options.deliveryMinimumCents || subtotal >= options.deliveryMinimumCents;

  function changeInterval(key: string, next: Interval) {
    const line = cart.lines.find((l) => l.key === key);
    if (!line || line.interval === next) return;
    cart.remove(key);
    cart.add({ ...line, interval: next });
  }

  async function checkout() {
    setError(null);
    if (!shape.ok) return setError(shape.error);
    if (!zipOk) return setError("Enter a ZIP code in our delivery area, or choose pickup.");
    setPending(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: cart.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, interval: l.interval })),
          fulfillment: method,
          deliveryZip: method === "delivery" ? zip : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error || "Checkout couldn't start. Try again.");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("You appear to be offline. Try again.");
      setPending(false);
    }
  }

  if (!cart.ready) return <p className="muted">Loading your cart…</p>;
  if (!cart.lines.length)
    return (
      <div className="narrow">
        <p className="lede">Your cart is empty.</p>
        <Link className="btn" href="/shop">
          Browse coffee
        </Link>
      </div>
    );

  return (
    <div className="cart-layout">
      <div>
        {cart.lines.map((l) => (
          <div className="cart-line" key={l.key}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {l.image ? <img src={l.image} alt="" /> : <div className="menu-thumb" />}
            <div>
              <h3>
                <Link href={`/products/${l.handle}`}>{l.productTitle}</Link>
              </h3>
              <div className="sub">
                {l.variantTitle}
                {l.variantTitle ? ". " : ""}
                {formatCents(l.unitPriceCents)} each
              </div>
              {l.interval ? (
                <div className="sub">
                  <label htmlFor={`int-${l.key}`}>Subscription: </label>
                  <select
                    id={`int-${l.key}`}
                    value={l.interval}
                    onChange={(e) => changeInterval(l.key, e.target.value as Interval)}
                    style={{ width: "auto", minHeight: 32, padding: "0.1rem 0.4rem" }}
                  >
                    {options.intervals.map((i) => (
                      <option key={i} value={i}>
                        {INTERVALS[i].label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="buy-row" style={{ marginTop: "0.4rem" }}>
                <div className="qty">
                  <button type="button" aria-label="Decrease quantity" onClick={() => cart.setQuantity(l.key, l.quantity - 1)}>
                    −
                  </button>
                  <input
                    aria-label="Quantity"
                    type="number"
                    min={1}
                    max={50}
                    value={l.quantity}
                    onChange={(e) => cart.setQuantity(l.key, Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                  />
                  <button type="button" aria-label="Increase quantity" onClick={() => cart.setQuantity(l.key, l.quantity + 1)}>
                    +
                  </button>
                </div>
                <button type="button" className="link-button" onClick={() => cart.remove(l.key)}>
                  Remove
                </button>
              </div>
            </div>
            <div className="menu-price">{formatCents(l.unitPriceCents * l.quantity)}</div>
          </div>
        ))}
        <p className="muted small" style={{ marginTop: "1rem" }}>
          <Link href="/shop">Keep shopping</Link>
        </p>
      </div>

      <aside className="panel" aria-label="Order summary">
        <h2 style={{ fontSize: "var(--step-1)" }}>How you'll get it</h2>
        {options.pickupEnabled && (
          <label className="method">
            <input type="radio" name="method" checked={method === "pickup"} onChange={() => setMethod("pickup")} />
            <span>
              <strong>Pickup, free</strong>
              <small>{options.pickupAddress}</small>
              <small>{options.pickupInstructions}</small>
            </span>
          </label>
        )}
        {options.deliveryEnabled && (
          <label className="method">
            <input type="radio" name="method" checked={method === "delivery"} onChange={() => setMethod("delivery")} />
            <span>
              <strong>Local delivery{options.deliveryFeeCents ? `, ${formatCents(options.deliveryFeeCents)}` : ", free"}</strong>
              <small>{options.deliveryNote}</small>
            </span>
          </label>
        )}
        {method === "delivery" && (
          <div className="field">
            <label htmlFor="zip">Delivery ZIP code</label>
            <input id="zip" inputMode="numeric" autoComplete="postal-code" maxLength={10} value={zip} onChange={(e) => setZip(e.target.value)} />
            {zip.length >= 5 && !zipOk && <span className="form-message error">We don't deliver there yet. Choose pickup instead.</span>}
            {!minOk && (
              <span className="form-message error">Local delivery needs an order of at least {formatCents(options.deliveryMinimumCents)}.</span>
            )}
          </div>
        )}
        {options.shippingEnabled && (
          <label className="method">
            <input type="radio" name="method" checked={method === "shipping"} onChange={() => setMethod("shipping")} />
            <span>
              <strong>Ship it</strong>
              <small>
                {formatCents(options.shippingFlatCents)}
                {options.freeShippingOverCents ? `, free over ${formatCents(options.freeShippingOverCents)}` : ""}
              </small>
            </span>
          </label>
        )}

        <div style={{ marginTop: "1rem" }}>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatCents(subtotal)}</span>
          </div>
          {feeLabel && (
            <div className="summary-row">
              <span>{feeLabel}</span>
              <span>{fee ? formatCents(fee) : "Free"}</span>
            </div>
          )}
          <div className="summary-row summary-total">
            <span>Estimated total</span>
            <span>{formatCents(subtotal + fee)}</span>
          </div>
          <p className="small muted">Have a discount code? Enter it on the payment page.</p>
          {hasSub && <p className="small muted">Subscription items renew automatically. Manage or cancel any time from your account.</p>}
        </div>

        {!shape.ok && <div className="notice error">{shape.error}</div>}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <button type="button" className="btn btn-cherry btn-block" onClick={checkout} disabled={pending || !shape.ok || !zipOk || !minOk}>
          {pending ? "Opening secure checkout…" : "Check out"}
        </button>
      </aside>
    </div>
  );
}

export { lineKey };
