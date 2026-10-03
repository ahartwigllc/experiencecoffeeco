/**
 * Copies product photos off Shopify's CDN into public/images/products/ and points
 * products at the local copies. Run BEFORE cancelling Shopify (the CDN links stop
 * working when the store closes), then commit public/images and redeploy.
 *
 *   npm run images:download
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { connect } from "../../scripts/db";

const { db, close } = connect();
const DIR = join(process.cwd(), "public", "images", "products");
mkdirSync(DIR, { recursive: true });

async function main() {
  const products = await db.select().from(schema.products);
  const cache = new Map<string, string>();
  for (const p of products) {
    const next: string[] = [];
    for (const [i, url] of p.images.entries()) {
      if (!/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) {
        next.push(url);
        continue;
      }
      const clean = url.split("?")[0]!;
      if (cache.has(clean)) {
        next.push(cache.get(clean)!);
        continue;
      }
      const ext = (clean.match(/\.(png|jpe?g|webp|gif)$/i)?.[1] ?? "jpg").toLowerCase();
      const file = `${p.handle}-${i + 1}.${ext}`;
      const res = await fetch(clean);
      if (!res.ok) {
        console.warn(`  Couldn't download ${clean} (${res.status}); keeping the old link.`);
        next.push(url);
        continue;
      }
      writeFileSync(join(DIR, file), Buffer.from(await res.arrayBuffer()));
      const local = `/images/products/${file}`;
      cache.set(clean, local);
      next.push(local);
      console.log(`  ${p.title}: ${file}`);
    }
    await db.update(schema.products).set({ images: next }).where(eq(schema.products.id, p.id));
  }
  console.log("\nDone. Commit public/images/products and redeploy.");
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
