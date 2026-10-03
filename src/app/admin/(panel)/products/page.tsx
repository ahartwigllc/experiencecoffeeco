import Link from "next/link";
import { asc } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { priceRange } from "@/lib/catalog-utils";
import { formatCents, percent } from "@/lib/money";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const products = await db().query.products.findMany({
    with: { variants: { orderBy: [asc(schema.variants.position)] } },
    orderBy: [asc(schema.products.status), asc(schema.products.sortOrder), asc(schema.products.title)],
  });

  return (
    <>
      <div className="admin-head">
        <h1>Products</h1>
        <Link className="btn btn-small" href="/admin/products/new">
          Add a product
        </Link>
      </div>
      <Flash {...sp} />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Product</th>
              <th>Status</th>
              <th className="num">Options</th>
              <th className="num">Price</th>
              <th className="num">In stock</th>
              <th className="num">Avg. margin</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const active = p.variants.filter((v) => v.active);
              const range = priceRange(active);
              const tracked = active.filter((v) => v.trackInventory);
              const withCost = active.filter((v) => v.unitCostCents !== null && v.priceCents > 0);
              const margin = withCost.length
                ? withCost.reduce((a, v) => a + (v.priceCents - v.unitCostCents!) / v.priceCents, 0) / withCost.length
                : null;
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/admin/products/${p.id}`}>{p.title}</Link>
                    {p.featured ? <span className="badge green" style={{ marginLeft: 6 }}>home page</span> : null}
                    <div className="small muted">/products/{p.handle}</div>
                  </td>
                  <td>
                    <span className={`badge ${p.status === "active" ? "green" : p.status === "archived" ? "" : "amber"}`}>{p.status}</span>
                  </td>
                  <td className="num">{active.length}</td>
                  <td className="num">{range ? (range.min === range.max ? formatCents(range.min) : `${formatCents(range.min)} to ${formatCents(range.max)}`) : "—"}</td>
                  <td className="num">{tracked.length ? tracked.reduce((a, v) => a + v.inventory, 0) : "made to order"}</td>
                  <td className="num">
                    {margin === null ? <span className="badge amber">add costs</span> : percent(margin, 0)}
                    {withCost.length > 0 && withCost.length < active.length ? <div className="small muted">partial</div> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
