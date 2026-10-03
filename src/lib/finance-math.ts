/**
 * Pure profit-and-loss math. Inputs are aggregates pulled from the database by
 * finance.ts. Kept free of imports so it's fully unit-tested.
 *
 *   Gross sales      = item prices before discounts
 *   Net sales        = gross - discounts - refunds
 *   Revenue          = net sales + delivery/shipping charged      (sales tax is NOT revenue)
 *   Gross profit     = revenue - payment fees - cost of goods
 *   Net profit       = gross profit - labor - operating expenses
 *   Profit per hour  = net profit / hours worked
 */
export type PnlInput = {
  orders: number;
  grossCents: number;
  discountCents: number;
  refundedCents: number;
  shippingCents: number;
  taxCents: number;
  feeCents: number;
  cogsCents: number;
  laborCents: number;
  expensesCents: number;
  hoursWorked: number;
  incomeTaxReservePercent?: number;
};

export type Pnl = PnlInput & {
  netSalesCents: number;
  revenueCents: number;
  grossProfitCents: number;
  netProfitCents: number;
  grossMargin: number | null;
  netMargin: number | null;
  profitPerHourCents: number | null;
  revenuePerHourCents: number | null;
  averageOrderCents: number | null;
  incomeTaxReserveCents: number;
  takeHomeCents: number;
};

export function computePnl(i: PnlInput): Pnl {
  const netSalesCents = i.grossCents - i.discountCents - i.refundedCents;
  const revenueCents = netSalesCents + i.shippingCents;
  const grossProfitCents = revenueCents - i.feeCents - i.cogsCents;
  const netProfitCents = grossProfitCents - i.laborCents - i.expensesCents;
  const reservePct = Math.max(0, Math.min(i.incomeTaxReservePercent ?? 0, 100));
  const incomeTaxReserveCents = netProfitCents > 0 ? Math.round((netProfitCents * reservePct) / 100) : 0;
  return {
    ...i,
    netSalesCents,
    revenueCents,
    grossProfitCents,
    netProfitCents,
    grossMargin: revenueCents > 0 ? grossProfitCents / revenueCents : null,
    netMargin: revenueCents > 0 ? netProfitCents / revenueCents : null,
    profitPerHourCents: i.hoursWorked > 0 ? Math.round(netProfitCents / i.hoursWorked) : null,
    revenuePerHourCents: i.hoursWorked > 0 ? Math.round(revenueCents / i.hoursWorked) : null,
    averageOrderCents: i.orders > 0 ? Math.round(revenueCents / i.orders) : null,
    incomeTaxReserveCents,
    takeHomeCents: netProfitCents - incomeTaxReserveCents,
  };
}

export const EMPTY_PNL_INPUT: PnlInput = {
  orders: 0,
  grossCents: 0,
  discountCents: 0,
  refundedCents: 0,
  shippingCents: 0,
  taxCents: 0,
  feeCents: 0,
  cogsCents: 0,
  laborCents: 0,
  expensesCents: 0,
  hoursWorked: 0,
};

/** Profit on a single order (used on the order detail page). */
export function orderProfitCents(o: {
  totalCents: number;
  taxCents: number;
  refundedCents: number;
  feeCents: number | null;
  cogsCents: number;
}): number {
  return o.totalCents - o.taxCents - o.refundedCents - (o.feeCents ?? 0) - o.cogsCents;
}

/** Stripe's standard US card pricing, used only to estimate fees not yet reported. */
export function estimateCardFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.round(amountCents * 0.029 + 30);
}
