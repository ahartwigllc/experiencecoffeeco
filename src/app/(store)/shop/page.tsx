import type { Metadata } from "next";
import { listStoreProducts } from "@/lib/catalog";
import { CoffeeMenu } from "@/components/CoffeeMenu";

export const metadata: Metadata = { title: "Shop coffee", description: "Every coffee and cold brew we're roasting right now." };

export default async function ShopPage() {
  const products = await listStoreProducts();
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="eyebrow">The menu</p>
        <h1>Coffee</h1>
        <p className="lede">Every bag is roasted to order in small batches. Whole bean, or ground for your brewer.</p>
      </div>
      {products.length ? <CoffeeMenu products={products} /> : <p>New coffee is on the way. Check back soon.</p>}
    </div>
  );
}
