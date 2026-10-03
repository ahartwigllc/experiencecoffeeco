/** Catalog helpers safe to use in client components (no database imports). */

export type VariantLike = {
  id: number;
  title: string;
  size: string | null;
  grind: string | null;
  priceCents: number;
  trackInventory: boolean;
  inventory: number;
  active: boolean;
};

export function inStock(v: Pick<VariantLike, "trackInventory" | "inventory">, qty = 1): boolean {
  return !v.trackInventory || v.inventory >= qty;
}

export function variantLabel(v: Pick<VariantLike, "size" | "grind" | "title">): string {
  const parts = [v.size, v.grind].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return v.title === "Default Title" || v.title === "Default" ? "" : v.title;
}

export function priceRange(vs: Pick<VariantLike, "priceCents">[]): { min: number; max: number } | null {
  if (!vs.length) return null;
  const prices = vs.map((v) => v.priceCents);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function uniqueValues<T>(arr: (T | null | undefined)[]): T[] {
  return [...new Set(arr.filter((x): x is T => x !== null && x !== undefined && x !== ""))];
}

/** Notes like "Strawberry wine, lime, gummy candy" -> ["Strawberry wine", "lime", "gummy candy"] */
export function splitNotes(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split(/,|\band\b/)
    .map((n) => n.trim())
    .filter(Boolean);
}
