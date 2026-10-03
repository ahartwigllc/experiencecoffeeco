import { getCurrentStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { isRangeKey, localDateString, rangeBounds } from "@/lib/dates";
import { getFinanceReport } from "@/lib/finance";
import { getSettings } from "@/lib/settings";

export async function GET(req: Request) {
  const me = await getCurrentStaff();
  if (!me || me.role !== "owner") return new Response("Forbidden", { status: 403 });
  const r = new URL(req.url).searchParams.get("range");
  const { start, end } = rangeBounds(isRangeKey(r) ? r : "ytd");
  const report = await getFinanceReport(start, end, await getSettings());
  const d = (c: number) => (c / 100).toFixed(2);
  const rows = [...report.months.map((m) => ({ label: m.month, p: m.pnl })), { label: "TOTAL", p: report.total }];
  const body = toCsv(
    ["month", "orders", "gross_sales", "discounts", "refunds", "net_sales", "shipping_charged", "revenue", "sales_tax_collected", "processing_fees", "cogs", "gross_profit", "labor", "operating_expenses", "net_profit", "hours_worked", "profit_per_hour", "income_tax_set_aside"],
    rows.map(({ label, p }) => [
      label, p.orders, d(p.grossCents), d(p.discountCents), d(p.refundedCents), d(p.netSalesCents), d(p.shippingCents), d(p.revenueCents),
      d(p.taxCents), d(p.feeCents), d(p.cogsCents), d(p.grossProfitCents), d(p.laborCents), d(p.expensesCents), d(p.netProfitCents),
      p.hoursWorked.toFixed(2), p.profitPerHourCents === null ? "" : d(p.profitPerHourCents), d(p.incomeTaxReserveCents),
    ]),
  );
  return csvResponse(`profit-and-loss-${localDateString(start)}-to-${localDateString(new Date(end.getTime() - 1))}.csv`, body);
}
