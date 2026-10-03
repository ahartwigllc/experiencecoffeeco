import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCurrentStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { localDateString } from "@/lib/dates";

export async function GET(req: Request) {
  const me = await getCurrentStaff();
  if (!me || me.role !== "owner") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where =
    status === "open"
      ? and(inArray(schema.orders.fulfillmentStatus, ["unfulfilled", "ready"]), inArray(schema.orders.status, ["paid", "partially_refunded"]))
      : status && ["paid", "refunded", "partially_refunded", "cancelled", "pending"].includes(status)
        ? eq(schema.orders.status, status as "paid")
        : undefined;
  const orders = await db().query.orders.findMany({ where, with: { items: true }, orderBy: [desc(schema.orders.createdAt)] });
  const d = (c: number | null) => (c === null ? "" : (c / 100).toFixed(2));
  const body = toCsv(
    ["number", "date", "source", "status", "fulfillment", "method", "customer", "email", "phone", "address", "items", "subtotal", "discount", "shipping", "tax", "total", "refunded", "fee", "payment_method", "discount_codes"],
    orders.map((o) => [
      o.number,
      o.createdAt,
      o.source,
      o.status,
      o.fulfillmentStatus,
      o.fulfillmentMethod,
      o.shipName,
      o.email,
      o.phone,
      [o.address1, o.address2, o.city, o.state, o.zip].filter(Boolean).join(", "),
      o.items.map((i) => `${i.quantity}x ${i.title}${i.variantTitle ? ` (${i.variantTitle})` : ""}`).join("; "),
      d(o.subtotalCents),
      d(o.discountCents),
      d(o.shippingCents),
      d(o.taxCents),
      d(o.totalCents),
      d(o.refundedCents),
      d(o.feeCents),
      o.paymentMethod,
      o.discountCodes.join(" "),
    ]),
  );
  return csvResponse(`orders-${localDateString()}.csv`, body);
}
