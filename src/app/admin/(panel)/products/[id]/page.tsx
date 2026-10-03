import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { centsToInput, formatCents, percent } from "@/lib/money";
import { subscriptionUnitPrice } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { addVariants, removeVariant, saveVariants } from "../../../actions/products";
import { ProductForm } from "../ProductForm";

export default async function EditProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const product = await db().query.products.findFirst({
    where: eq(schema.products.id, Number(id)),
    with: { variants: { orderBy: [asc(schema.variants.position), asc(schema.variants.id)] } },
  });
  if (!product) notFound();
  const settings = await getSettings();

  return (
    <>
      <div className="admin-head">
        <h1>{product.title}</h1>
        <div className="toolbar">
          {product.status === "active" && (
            <Link className="btn btn-small btn-ghost" href={`/products/${product.handle}`} target="_blank">
              View in store
            </Link>
          )}
          <Link className="btn btn-small btn-ghost" href="/admin/products">
            All products
          </Link>
        </div>
      </div>
      <Flash {...sp} />

      <div className="card">
        <h2>Sizes, grinds, prices, and costs</h2>
        <p className="small muted">
          Unit cost is what one bag or box costs you to make: green coffee, roast loss, bag, label. It drives every profit number.
          Subscription price is {settings.subscriptionDiscountPercent}% off.
        </p>
        {product.variants.length > 0 ? (
          <form action={saveVariants}>
            <input type="hidden" name="productId" value={product.id} />
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Size</th>
                    <th>Grind</th>
                    <th>Price</th>
                    <th>Unit cost</th>
                    <th className="num">Margin</th>
                    <th className="num">Sub. margin</th>
                    <th>Stock</th>
                    <th>Track stock</th>
                    <th>For sale</th>
                    <th>Order</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => {
                    const sub = subscriptionUnitPrice(v.priceCents, settings.subscriptionDiscountPercent);
                    const m = v.unitCostCents !== null && v.priceCents > 0 ? (v.priceCents - v.unitCostCents) / v.priceCents : null;
                    const sm = v.unitCostCents !== null && sub > 0 ? (sub - v.unitCostCents) / sub : null;
                    return (
                      <tr key={v.id}>
                        <td>
                          <input type="hidden" name="variantId" value={v.id} />
                          <input name={`v_${v.id}_size`} defaultValue={v.size ?? ""} aria-label="Size" style={{ width: 80 }} />
                        </td>
                        <td>
                          <input name={`v_${v.id}_grind`} defaultValue={v.grind ?? ""} aria-label="Grind" style={{ width: 110 }} />
                        </td>
                        <td>
                          <input name={`v_${v.id}_price`} defaultValue={centsToInput(v.priceCents)} inputMode="decimal" aria-label="Price" style={{ width: 80 }} />
                        </td>
                        <td>
                          <input name={`v_${v.id}_cost`} defaultValue={centsToInput(v.unitCostCents)} inputMode="decimal" aria-label="Unit cost" placeholder="add" style={{ width: 80 }} />
                        </td>
                        <td className="num">{m === null ? "—" : percent(m, 0)}</td>
                        <td className="num">{sm === null ? "—" : `${percent(sm, 0)} at ${formatCents(sub)}`}</td>
                        <td>
                          <input name={`v_${v.id}_inventory`} type="number" defaultValue={v.inventory} aria-label="Stock" style={{ width: 75 }} className={v.trackInventory && v.inventory < 0 ? "negative" : ""} />
                        </td>
                        <td>
                          <input type="checkbox" name={`v_${v.id}_track`} defaultChecked={v.trackInventory} aria-label="Track stock" />
                        </td>
                        <td>
                          <input type="checkbox" name={`v_${v.id}_active`} defaultChecked={v.active} aria-label="For sale" />
                        </td>
                        <td>
                          <input name={`v_${v.id}_position`} type="number" defaultValue={v.position} aria-label="Display order" style={{ width: 60 }} />
                          <input type="hidden" name={`v_${v.id}_sku`} value={v.sku ?? ""} />
                        </td>
                        <td />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: "0.75rem" }}>
              <button className="btn btn-small" type="submit">
                Save options
              </button>
            </p>
          </form>
        ) : (
          <p className="muted">No options yet. Add the first one below.</p>
        )}

        {product.variants.length > 0 && (
          <details>
            <summary className="small">Remove an option</summary>
            <div className="toolbar" style={{ marginTop: "0.5rem" }}>
              {product.variants.map((v) => (
                <form action={removeVariant} key={v.id}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="variantId" value={v.id} />
                  <ConfirmButton message={`Remove ${v.title}?`}>{v.title}</ConfirmButton>
                </form>
              ))}
            </div>
          </details>
        )}

        <h3 style={{ marginTop: "1.5rem" }}>Add options</h3>
        <form action={addVariants} className="admin-form">
          <input type="hidden" name="productId" value={product.id} />
          <div className="row">
            <div className="field">
              <label htmlFor="nv-size">Size</label>
              <input id="nv-size" name="size" placeholder="12oz" />
            </div>
            <div className="field">
              <label htmlFor="nv-grinds">Grinds (comma separated)</label>
              <input id="nv-grinds" name="grinds" placeholder="Whole Bean, Coarse, Medium, Fine" />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="nv-price">Price</label>
              <input id="nv-price" name="price" inputMode="decimal" required />
            </div>
            <div className="field">
              <label htmlFor="nv-cost">Unit cost</label>
              <input id="nv-cost" name="cost" inputMode="decimal" />
            </div>
            <div className="field">
              <label htmlFor="nv-inv">Starting stock</label>
              <input id="nv-inv" name="inventory" type="number" defaultValue={0} />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" name="track" defaultChecked={product.kind !== "cold_brew"} /> Track stock (turn off for made-to-order)
          </label>
          <div>
            <button className="btn btn-small" type="submit">
              Add
            </button>
          </div>
        </form>
      </div>

      <h2>Details</h2>
      <ProductForm product={product} />
    </>
  );
}
