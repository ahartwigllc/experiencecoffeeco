import type { Product } from "@/db/schema";
import { centsToInput } from "@/lib/money";
import { saveProduct } from "../../actions/products";

export function ProductForm({ product, defaultDiscountPercent }: { product?: Product; defaultDiscountPercent?: number }) {
  const discountType = product?.subscriptionDiscountType ?? "default";
  const discountValue =
    product?.subscriptionDiscountValue == null
      ? ""
      : discountType === "amount"
        ? centsToInput(product.subscriptionDiscountValue)
        : String(product.subscriptionDiscountValue);
  return (
    <form action={saveProduct} className="admin-form card" style={{ maxWidth: 900 }}>
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <div className="row">
        <div className="field">
          <label htmlFor="title">Name</label>
          <input id="title" name="title" defaultValue={product?.title} required />
        </div>
        <div className="field">
          <label htmlFor="handle">
            Web address <span className="field-hint">experiencecoffee.co/products/…</span>
          </label>
          <input id="handle" name="handle" defaultValue={product?.handle} placeholder="made from the name if blank" />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="status">Status</label>
          <select id="status" name="status" defaultValue={product?.status ?? "draft"}>
            <option value="active">Active (for sale)</option>
            <option value="draft">Draft (hidden)</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={product?.kind ?? "beans"}>
            <option value="beans">Coffee beans</option>
            <option value="cold_brew">Cold brew</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sortOrder">Sort order</label>
          <input id="sortOrder" name="sortOrder" type="number" defaultValue={product?.sortOrder ?? 0} />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="origin">Origin</label>
          <input id="origin" name="origin" defaultValue={product?.origin ?? ""} placeholder="Peru, Agua Colorada" />
        </div>
        <div className="field">
          <label htmlFor="process">Process</label>
          <input id="process" name="process" defaultValue={product?.process ?? ""} placeholder="Natural" />
        </div>
        <div className="field">
          <label htmlFor="cuppingScore">Cupping score</label>
          <input id="cuppingScore" name="cuppingScore" defaultValue={product?.cuppingScore ?? ""} placeholder="87.5" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="flavorNotes">
          Flavor notes <span className="field-hint">Comma separated. Shown large on the product page and home page.</span>
        </label>
        <input id="flavorNotes" name="flavorNotes" defaultValue={product?.flavorNotes ?? ""} placeholder="Strawberry wine, lime, gummy candy" />
      </div>
      <div className="field">
        <label htmlFor="descriptionHtml">
          Description <span className="field-hint">HTML is allowed (paragraphs, bold, italics).</span>
        </label>
        <textarea id="descriptionHtml" name="descriptionHtml" rows={8} defaultValue={product?.descriptionHtml ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="images">
          Photos <span className="field-hint">One image address per line. The first is the main photo.</span>
        </label>
        <textarea id="images" name="images" rows={3} defaultValue={product?.images.join("\n") ?? ""} />
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="taxCode">
            Stripe tax code <span className="field-hint">Only used if Stripe Tax is on.</span>
          </label>
          <input id="taxCode" name="taxCode" defaultValue={product?.taxCode ?? ""} placeholder="txcd_..." />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="subscriptionEnabled" defaultChecked={product?.subscriptionEnabled ?? true} /> Offer as a subscription
      </label>
      <div className="row">
        <div className="field">
          <label htmlFor="subscriptionDiscountType">
            Subscriber discount <span className="field-hint">Applies to every size and grind of this product.</span>
          </label>
          <select id="subscriptionDiscountType" name="subscriptionDiscountType" defaultValue={discountType}>
            <option value="default">
              Store default{defaultDiscountPercent != null ? ` (${defaultDiscountPercent}% off)` : ""}
            </option>
            <option value="percent">Percent off</option>
            <option value="amount">Dollar amount off each item</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="subscriptionDiscountValue">
            Amount <span className="field-hint">e.g. 15 for 15%, or 3.00 for $3 off. Ignored for store default.</span>
          </label>
          <input id="subscriptionDiscountValue" name="subscriptionDiscountValue" inputMode="decimal" defaultValue={discountValue} placeholder="15 or 3.00" />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} /> Feature on the home page
      </label>
      <div>
        <button className="btn" type="submit">
          {product ? "Save product" : "Create product"}
        </button>
      </div>
    </form>
  );
}
