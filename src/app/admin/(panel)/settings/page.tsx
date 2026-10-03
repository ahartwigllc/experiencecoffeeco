import { Flash } from "@/components/admin/Flash";
import { requireOwner } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { centsToInput } from "@/lib/money";
import { INTERVALS, type Interval } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { isStripeConfigured } from "@/lib/stripe";
import { saveStoreSettings } from "../../actions/system";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <>
      <div className="admin-head">
        <h1>Settings</h1>
      </div>
      <Flash {...sp} />
      <div className="card small">
        Stripe: {isStripeConfigured() ? <span className="badge green">connected</span> : <span className="badge red">not connected</span>}{" "}
        Email: {isEmailConfigured() ? <span className="badge green">connected</span> : <span className="badge red">not connected</span>}{" "}
        <span className="muted">Keys are set as environment secrets, not here. See docs/DEPLOYMENT.md.</span>
      </div>

      <form action={saveStoreSettings} className="admin-form" style={{ maxWidth: 860 }}>
        <div className="card">
          <h2>Store</h2>
          <div className="row">
            <div className="field"><label htmlFor="businessName">Business name</label><input id="businessName" name="businessName" defaultValue={s.businessName} /></div>
            <div className="field"><label htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={s.phone} /></div>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="supportEmail">Customer support email</label><input id="supportEmail" name="supportEmail" type="email" defaultValue={s.supportEmail} /></div>
            <div className="field"><label htmlFor="ownerNotifyEmail">Send new-order alerts to</label><input id="ownerNotifyEmail" name="ownerNotifyEmail" type="email" defaultValue={s.ownerNotifyEmail} /></div>
          </div>
          <div className="field">
            <label htmlFor="businessPostalAddress">Mailing address for marketing emails <span className="field-hint">Required by law in every marketing email. A PO box is fine.</span></label>
            <input id="businessPostalAddress" name="businessPostalAddress" defaultValue={s.businessPostalAddress} />
          </div>
          <div className="field"><label htmlFor="announcement">Announcement bar <span className="field-hint">Shown above every page. Leave blank to hide.</span></label><input id="announcement" name="announcement" defaultValue={s.announcement} maxLength={160} /></div>
          <div className="row">
            <div className="field"><label htmlFor="instagramUrl">Instagram link</label><input id="instagramUrl" name="instagramUrl" type="url" defaultValue={s.instagramUrl} placeholder="https://instagram.com/…" /></div>
            <div className="field"><label htmlFor="tiktokUrl">TikTok link</label><input id="tiktokUrl" name="tiktokUrl" type="url" defaultValue={s.tiktokUrl} /></div>
          </div>
        </div>

        <div className="card">
          <h2>Subscriptions</h2>
          <div className="row">
            <div className="field"><label htmlFor="subscriptionDiscountPercent">Subscriber discount (%)</label><input id="subscriptionDiscountPercent" name="subscriptionDiscountPercent" type="number" min={0} max={90} defaultValue={s.subscriptionDiscountPercent} /></div>
          </div>
          <fieldset className="option-group">
            <legend>Schedules customers can choose</legend>
            {(Object.keys(INTERVALS) as Interval[]).map((i) => (
              <label key={i} className="check">
                <input type="checkbox" name="subscriptionIntervals" value={i} defaultChecked={s.subscriptionIntervals.includes(i)} /> {INTERVALS[i].label}
              </label>
            ))}
          </fieldset>
          <p className="small muted">Changing the discount affects new subscriptions only. Existing subscribers keep their price.</p>
        </div>

        <div className="card">
          <h2>Pickup, delivery, shipping</h2>
          <label className="check"><input type="checkbox" name="pickupEnabled" defaultChecked={s.pickupEnabled} /> Offer pickup</label>
          <div className="field"><label htmlFor="pickupAddress">Pickup address</label><input id="pickupAddress" name="pickupAddress" defaultValue={s.pickupAddress} /></div>
          <div className="field"><label htmlFor="pickupInstructions">Pickup instructions</label><input id="pickupInstructions" name="pickupInstructions" defaultValue={s.pickupInstructions} /></div>
          <hr />
          <label className="check"><input type="checkbox" name="deliveryEnabled" defaultChecked={s.deliveryEnabled} /> Offer local delivery</label>
          <div className="row">
            <div className="field"><label htmlFor="deliveryFee">Delivery fee ($)</label><input id="deliveryFee" name="deliveryFee" inputMode="decimal" defaultValue={centsToInput(s.deliveryFeeCents)} /></div>
            <div className="field"><label htmlFor="deliveryMinimum">Minimum order ($)</label><input id="deliveryMinimum" name="deliveryMinimum" inputMode="decimal" defaultValue={centsToInput(s.deliveryMinimumCents)} /></div>
          </div>
          <div className="field"><label htmlFor="deliveryZips">ZIP codes you deliver to <span className="field-hint">Separated by commas or spaces.</span></label><textarea id="deliveryZips" name="deliveryZips" rows={2} defaultValue={s.deliveryZips.join(", ")} /></div>
          <div className="field"><label htmlFor="deliveryNote">Delivery note for customers</label><input id="deliveryNote" name="deliveryNote" defaultValue={s.deliveryNote} /></div>
          <hr />
          <label className="check"><input type="checkbox" name="shippingEnabled" defaultChecked={s.shippingEnabled} /> Offer shipping (US)</label>
          <div className="row">
            <div className="field"><label htmlFor="shippingFlat">Flat shipping rate ($)</label><input id="shippingFlat" name="shippingFlat" inputMode="decimal" defaultValue={centsToInput(s.shippingFlatCents)} /></div>
            <div className="field"><label htmlFor="freeShippingOver">Free shipping over ($, 0 = never)</label><input id="freeShippingOver" name="freeShippingOver" inputMode="decimal" defaultValue={centsToInput(s.freeShippingOverCents)} /></div>
          </div>
        </div>

        <div className="card">
          <h2>Taxes and profit</h2>
          <div className="field">
            <label htmlFor="taxMode">Sales tax at checkout</label>
            <select id="taxMode" name="taxMode" defaultValue={s.taxMode}>
              <option value="none">Don't charge sales tax (how the Shopify store ran)</option>
              <option value="stripe_tax">Calculate with Stripe Tax (turn on Stripe Tax in your Stripe dashboard first)</option>
            </select>
          </div>
          <div className="row">
            <div className="field"><label htmlFor="incomeTaxReservePercent">Income tax set-aside (% of profit)</label><input id="incomeTaxReservePercent" name="incomeTaxReservePercent" type="number" min={0} max={60} defaultValue={s.incomeTaxReservePercent} /></div>
            <div className="field"><label htmlFor="lowInventoryThreshold">Low stock warning at</label><input id="lowInventoryThreshold" name="lowInventoryThreshold" type="number" min={0} defaultValue={s.lowInventoryThreshold} /></div>
          </div>
          <div className="field">
            <label htmlFor="cogsMethod">How to count cost of goods</label>
            <select id="cogsMethod" name="cogsMethod" defaultValue={s.cogsMethod}>
              <option value="unit_cost">Unit cost per bag × bags sold (more accurate month to month)</option>
              <option value="purchases">Green coffee, packaging, and ingredient purchases when bought (simpler)</option>
            </select>
          </div>
        </div>
        <div>
          <button className="btn" type="submit">Save settings</button>
        </div>
      </form>
    </>
  );
}
