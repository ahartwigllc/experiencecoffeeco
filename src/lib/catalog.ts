import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Product, Variant } from "@/db/schema";

export type CatalogProduct = Product & { variants: Variant[] };

export async function listStoreProducts(): Promise<CatalogProduct[]> {
  return db().query.products.findMany({
    where: eq(schema.products.status, "active"),
    with: { variants: { where: eq(schema.variants.active, true), orderBy: [asc(schema.variants.position), asc(schema.variants.id)] } },
    orderBy: [asc(schema.products.sortOrder), asc(schema.products.id)],
  });
}

export async function getStoreProduct(handle: string): Promise<CatalogProduct | null> {
  const p = await db().query.products.findFirst({
    where: and(eq(schema.products.handle, handle), eq(schema.products.status, "active")),
    with: { variants: { where: eq(schema.variants.active, true), orderBy: [asc(schema.variants.position), asc(schema.variants.id)] } },
  });
  return p ?? null;
}

export async function getVariantsWithProducts(ids: number[]) {
  if (!ids.length) return [];
  return db()
    .select({ variant: schema.variants, product: schema.products })
    .from(schema.variants)
    .innerJoin(schema.products, eq(schema.variants.productId, schema.products.id))
    .where(inArray(schema.variants.id, ids));
}
