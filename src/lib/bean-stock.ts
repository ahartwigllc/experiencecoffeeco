/**
 * Bean stock: coffee is roasted and ground to order, so stock is the pounds of GREEN coffee on hand
 * per product (products.green_stock_grams), not a count per size and grind. Every sale of any size or
 * grind draws from it, accounting for roast loss. Pure functions; safe in client components.
 *
 * green_stock_grams = null means "not tracking" for that product (sell freely).
 */

export const ROAST_LOSS_PERCENT = 15;
export const GRAMS_PER_LB = 453.59237;

/** Roasted weight in pounds from a size label: "12oz", "8 oz", "2lb", "2 lbs", "1.5 lb", "500g", "1kg". */
export function roastedLbsFromSize(size: string | null | undefined): number | null {
  if (!size) return null;
  const m = size.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(oz|ounces?|lbs?|pounds?|g|grams?|kg)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]!;
  if (!(n > 0)) return null;
  if (unit.startsWith("oz") || unit.startsWith("ounce")) return n / 16;
  if (unit.startsWith("lb") || unit.startsWith("pound")) return n;
  if (unit === "kg") return (n * 1000) / GRAMS_PER_LB;
  return n / GRAMS_PER_LB; // grams
}

/** Green coffee (grams) one unit of this size uses, after roast loss. */
export function greenGramsPerUnit(size: string | null | undefined, roastLossPercent = ROAST_LOSS_PERCENT): number | null {
  const lbs = roastedLbsFromSize(size);
  if (lbs === null) return null;
  return (lbs * GRAMS_PER_LB) / (1 - roastLossPercent / 100);
}

/** How many units of this size the green stock covers. */
export function unitsFromGreenStock(greenGrams: number, size: string | null | undefined): number | null {
  const per = greenGramsPerUnit(size);
  if (per === null) return null;
  return Math.max(0, Math.floor(greenGrams / per + 1e-9));
}

/**
 * For a bean-tracked product, replace each variant's own stock with what the green stock covers,
 * so existing availability checks (inStock, "Only N left") work unchanged.
 */
export function applyBeanStock<V extends { size: string | null; trackInventory: boolean; inventory: number }>(
  product: { greenStockGrams: number | null },
  variants: V[],
): V[] {
  if (product.greenStockGrams === null) return variants;
  const grams = product.greenStockGrams;
  return variants.map((v) => {
    const units = unitsFromGreenStock(grams, v.size);
    return units === null ? v : { ...v, trackInventory: true, inventory: units };
  });
}

export const gramsToLbs = (g: number) => g / GRAMS_PER_LB;
export const lbsToGrams = (lb: number) => Math.round(lb * GRAMS_PER_LB);
export const formatLbs = (g: number) => `${(Math.round(gramsToLbs(g) * 10) / 10).toFixed(1)} lb`;
