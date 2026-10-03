/**
 * Loads migration/data/*.json (from export-shopify.ts) into the new database.
 *
 *   npm run shopify:import              # products, customers, subscribers, orders, coupons
 *   npm run shopify:import -- --dry-run # parse and report, write nothing
 *   npm run db:seed                     # catalog only, from products.snapshot.json (no token needed)
 *
 * Safe to run more than once: rows are matched by their Shopify id, so re-running
 * after a fresh export adds new orders/customers without duplicating old ones.
 * Product edits you made in the new admin are kept (only new products/options are added).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { connect } from "../../scripts/db";
import * as schema from "../../src/db/schema";
import { intervalFromShopifyPlan } from "../../src/lib/pricing";
import { estimateCardFeeCents } from "../../src/lib/finance-math";
import { parseDescription } from "../../src/lib/shopify-parse";

const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run");
const SNAPSHOT_ONLY = args.has("--snapshot");
const DATA = join(process.cwd(), "migration", "data");

const conn = DRY ? null : connect();
const db = conn ? conn.db : (null as never);

const read = <T>(file: string): T | null => (existsSync(join(DATA, file)) ? (JSON.parse(readFileSync(join(DATA, file), "utf8")) as T) : null);
const cents = (m?: { shopMoney?: { amount?: string } } | null) => Math.round(Number(m?.shopMoney?.amount ?? 0) * 100);
const dollars = (a?: string | null) => Math.round(Number(a ?? 0) * 100);

/* ------------------------------------------------------------ products */

type SProduct = {
  id: string; handle: string; title: string; status: string; descriptionHtml: string; createdAt: string;
  variants: { nodes: { id: string; title: string; sku: string | null; price: string; position: number; inventoryQuantity: number | null;
    inventoryItem: { tracked: boolean; unitCost: { amount: string } | null } | null; selectedOptions: { name: string; value: string }[] }[] };
  media: { nodes: ({ image?: { url: string } } | Record<string, never>)[] };
};

async function importProducts(products: SProduct[]) {
  const best = products
    .filter((p) => p.status === "ACTIVE")
    .map((p) => ({ p, score: Number(parseDescription(p.title, p.descriptionHtml).cuppingScore ?? 0) }))
    .sort((a, b) => b.score - a.score)[0];
  let created = 0;
  let variantsCreated = 0;
  for (const [idx, p] of products.entries()) {
    const parsed = parseDescription(p.title, p.descriptionHtml);
    const isColdBrew = /cold\s*brew/i.test(p.title);
    const values = {
      handle: p.handle,
      title: p.title,
      kind: (isColdBrew ? "cold_brew" : "beans") as "cold_brew" | "beans",
      status: (p.status.toLowerCase() === "active" ? "active" : p.status.toLowerCase() === "archived" ? "archived" : "draft") as "active" | "archived" | "draft",
      descriptionHtml: parsed.descriptionHtml,
      flavorNotes: parsed.flavorNotes,
      cuppingScore: parsed.cuppingScore,
      process: parsed.process,
      origin: parsed.origin,
      images: p.media.nodes.map((m) => ("image" in m && m.image ? m.image.url : null)).filter((u): u is string => !!u),
      subscriptionEnabled: true,
      featured: best?.p.id === p.id,
      sortOrder: isColdBrew ? 0 : p.status === "ACTIVE" ? 10 + idx : 90,
      shopifyId: p.id,
      createdAt: new Date(p.createdAt),
    };
    if (DRY) {
      console.log(`  product ${p.title}: notes="${values.flavorNotes ?? ""}" process="${values.process ?? ""}" score=${values.cuppingScore ?? "-"}`);
      continue;
    }
    const [row] = await db.insert(schema.products).values(values).onConflictDoNothing({ target: schema.products.shopifyId }).returning({ id: schema.products.id });
    const productId = row?.id ?? (await db.query.products.findFirst({ where: eq(schema.products.shopifyId, p.id) }))!.id;
    if (row) created++;
    for (const v of p.variants.nodes) {
      const size = v.selectedOptions.find((o) => /size/i.test(o.name) && !/grind/i.test(o.name))?.value ?? null;
      const grind = v.selectedOptions.find((o) => /grind/i.test(o.name))?.value ?? null;
      const tracked = isColdBrew ? false : v.inventoryItem?.tracked ?? true;
      const [vr] = await db
        .insert(schema.variants)
        .values({
          productId,
          title: v.title === "Default Title" ? "Default" : v.title,
          size,
          grind,
          priceCents: dollars(v.price),
          unitCostCents: v.inventoryItem?.unitCost ? dollars(v.inventoryItem.unitCost.amount) : null,
          sku: v.sku || null,
          trackInventory: tracked,
          inventory: Math.max(0, v.inventoryQuantity ?? 0),
          position: v.position ?? 0,
          shopifyId: v.id,
        })
        .onConflictDoNothing({ target: schema.variants.shopifyId })
        .returning({ id: schema.variants.id });
      if (vr) variantsCreated++;
    }
  }
  console.log(`Products: ${created} new (${products.length} in file), ${variantsCreated} new options.`);
}

/* ----------------------------------------------------------- customers */

type SCustomer = {
  id: string; firstName: string | null; lastName: string | null; createdAt: string; note: string | null;
  defaultEmailAddress: { emailAddress: string; marketingState: string; marketingUpdatedAt: string | null } | null;
  defaultPhoneNumber: { phoneNumber: string } | null;
  defaultAddress: { address1: string | null; address2: string | null; city: string | null; provinceCode: string | null; zip: string | null } | null;
};

async function importCustomers(list: SCustomer[]) {
  let created = 0;
  let subs = 0;
  for (const c of list) {
    const email = c.defaultEmailAddress?.emailAddress?.trim().toLowerCase() || null;
    const accepts = c.defaultEmailAddress?.marketingState === "SUBSCRIBED";
    if (DRY) continue;
    const values = {
      email,
      phone: c.defaultPhoneNumber?.phoneNumber ?? null,
      firstName: c.firstName,
      lastName: c.lastName,
      acceptsMarketing: accepts,
      address1: c.defaultAddress?.address1 ?? null,
      address2: c.defaultAddress?.address2 ?? null,
      city: c.defaultAddress?.city ?? null,
      state: c.defaultAddress?.provinceCode ?? null,
      zip: c.defaultAddress?.zip ?? null,
      note: c.note || null,
      shopifyId: c.id,
      createdAt: new Date(c.createdAt),
    };
    let row: { id: number } | undefined = (await db.insert(schema.customers).values(values).onConflictDoNothing().returning({ id: schema.customers.id }))[0];
    if (row) created++;
    if (!row && email) {
      // Same email already exists (e.g. they ordered on the new site first): link the Shopify id.
      const existing = await db.query.customers.findFirst({ where: eq(schema.customers.email, email) });
      if (existing && !existing.shopifyId) await db.update(schema.customers).set({ shopifyId: c.id }).where(eq(schema.customers.id, existing.id));
      row = existing ? { id: existing.id } : undefined;
    }
    if (email && accepts) {
      const r = await db
        .insert(schema.subscribers)
        .values({
          email,
          status: "subscribed",
          source: "shopify_import",
          confirmedAt: c.defaultEmailAddress?.marketingUpdatedAt ? new Date(c.defaultEmailAddress.marketingUpdatedAt) : new Date(c.createdAt),
          customerId: row?.id ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: schema.subscribers.id });
      if (r.length) subs++;
    }
  }
  console.log(`Customers: ${created} new (${list.length} in file). Email subscribers added: ${subs}.`);
}

/* -------------------------------------------------------------- orders */

type SOrder = {
  id: string; name: string; createdAt: string; cancelledAt: string | null; email: string | null; phone: string | null; note: string | null;
  displayFinancialStatus: string; displayFulfillmentStatus: string; customer: { id: string } | null; discountCodes: string[];
  subtotalPriceSet: Money; totalDiscountsSet: Money; totalTaxSet: Money; totalShippingPriceSet: Money; totalPriceSet: Money; totalRefundedSet: Money;
  shippingLine: { title: string } | null;
  shippingAddress: { name: string | null; address1: string | null; address2: string | null; city: string | null; provinceCode: string | null; zip: string | null; countryCodeV2: string | null } | null;
  lineItems: { nodes: { title: string; variantTitle: string | null; quantity: number; variant: { id: string } | null; product: { id: string } | null;
    originalUnitPriceSet: Money; discountedTotalSet: Money; sellingPlan: { name: string } | null }[] };
  transactions: { gateway: string; kind: string; status: string; amountSet: Money; fees: { amount: { amount: string } }[] }[];
};
type Money = { shopMoney: { amount: string } };

function mapStatus(o: SOrder): "paid" | "refunded" | "partially_refunded" | "cancelled" | "pending" {
  if (o.cancelledAt) return "cancelled";
  switch (o.displayFinancialStatus) {
    case "REFUNDED": return "refunded";
    case "PARTIALLY_REFUNDED": return "partially_refunded";
    case "VOIDED":
    case "EXPIRED": return "cancelled";
    case "PENDING":
    case "AUTHORIZED": return "pending";
    default: return "paid";
  }
}

async function importOrders(list: SOrder[]) {
  const legacyCosts = existsSync(join(process.cwd(), "migration", "legacy-costs.json"))
    ? (JSON.parse(readFileSync(join(process.cwd(), "migration", "legacy-costs.json"), "utf8")) as Record<string, number>)
    : {};
  const customers = DRY ? [] : await db.select({ id: schema.customers.id, shopifyId: schema.customers.shopifyId }).from(schema.customers);
  const variants = DRY ? [] : await db.select({ id: schema.variants.id, shopifyId: schema.variants.shopifyId, productId: schema.variants.productId }).from(schema.variants);
  const products = DRY ? [] : await db.select({ id: schema.products.id, shopifyId: schema.products.shopifyId }).from(schema.products);
  const cMap = new Map(customers.map((c) => [c.shopifyId, c.id]));
  const vMap = new Map(variants.map((v) => [v.shopifyId, v]));
  const pMap = new Map(products.map((p) => [p.shopifyId, p.id]));

  let created = 0;
  let totalCents = 0;
  for (const o of list) {
    const number = Number(o.name.replace(/\D/g, ""));
    const ship = o.shippingLine?.title ?? "";
    const method: "delivery" | "pickup" | "shipping" = /local delivery/i.test(ship)
      ? "delivery"
      : !o.shippingAddress || /pickup|anthony/i.test(ship)
        ? "pickup"
        : "shipping";
    const success = o.transactions.filter((t) => t.status === "SUCCESS" && ["SALE", "CAPTURE"].includes(t.kind));
    const gateway = success[0]?.gateway ?? o.transactions[0]?.gateway ?? "";
    const paymentMethod = /cash|cod/i.test(gateway) ? "cash" : gateway === "shopify_payments" ? "shopify_payments" : gateway || "other";
    const reportedFee = success.reduce((a, t) => a + t.fees.reduce((b, f) => b + dollars(f.amount.amount), 0), 0);
    const hasFeeData = success.some((t) => t.fees.length > 0);
    const total = cents(o.totalPriceSet);
    const status = mapStatus(o);
    const feeCents = paymentMethod === "cash" ? 0 : hasFeeData ? reportedFee : paymentMethod === "shopify_payments" && status !== "cancelled" ? estimateCardFeeCents(total) : 0;
    if (status !== "cancelled" && status !== "pending") totalCents += total;
    if (DRY) continue;

    const items = o.lineItems.nodes.map((li) => {
      const v = li.variant ? vMap.get(li.variant.id) : undefined;
      return {
        productId: v?.productId ?? (li.product ? pMap.get(li.product.id) ?? null : null),
        variantId: v?.id ?? null,
        title: li.title,
        variantTitle: li.variantTitle,
        quantity: li.quantity,
        unitPriceCents: cents(li.originalUnitPriceSet),
        totalCents: cents(li.discountedTotalSet),
        unitCostCents: v ? null : legacyCosts[li.title] ?? null,
        subscriptionInterval: intervalFromShopifyPlan(li.sellingPlan?.name),
      };
    });
    const [row] = await db
      .insert(schema.orders)
      .values({
        number,
        source: "shopify",
        status,
        fulfillmentStatus: o.displayFulfillmentStatus === "FULFILLED" ? "fulfilled" : "unfulfilled",
        fulfillmentMethod: method,
        customerId: o.customer ? cMap.get(o.customer.id) ?? null : null,
        email: o.email?.toLowerCase() ?? null,
        phone: o.phone,
        shipName: o.shippingAddress?.name ?? null,
        address1: o.shippingAddress?.address1 ?? null,
        address2: o.shippingAddress?.address2 ?? null,
        city: o.shippingAddress?.city ?? null,
        state: o.shippingAddress?.provinceCode ?? null,
        zip: o.shippingAddress?.zip ?? null,
        country: o.shippingAddress?.countryCodeV2 ?? null,
        // Shopify's subtotal is after line discounts; add discounts back to get gross sales.
        subtotalCents: cents(o.subtotalPriceSet) + cents(o.totalDiscountsSet),
        discountCents: cents(o.totalDiscountsSet),
        shippingCents: cents(o.totalShippingPriceSet),
        taxCents: cents(o.totalTaxSet),
        totalCents: total,
        refundedCents: cents(o.totalRefundedSet),
        feeCents,
        paymentMethod,
        discountCodes: o.discountCodes ?? [],
        shopifyId: o.id,
        note: [o.note, !hasFeeData && paymentMethod === "shopify_payments" ? "Fee estimated at 2.9% + 30¢ (Shopify didn't report it)." : null].filter(Boolean).join(" ") || null,
        fulfilledAt: o.displayFulfillmentStatus === "FULFILLED" ? new Date(o.createdAt) : null,
        createdAt: new Date(o.createdAt),
      })
      .onConflictDoNothing()
      .returning({ id: schema.orders.id });
    if (!row) continue;
    created++;
    if (items.length) await db.insert(schema.orderItems).values(items.map((i) => ({ ...i, orderId: row.id })));
  }
  console.log(`Orders: ${created} new (${list.length} in file). Paid order total in file: $${(totalCents / 100).toFixed(2)}.`);
}

/* ------------------------------------------------------------ discounts */

type SDiscount = {
  id: string;
  discount: {
    __typename: string; title?: string; status?: string; endsAt?: string | null; usageLimit?: number | null; asyncUsageCount?: number;
    codes?: { nodes: { code: string }[] };
    customerGets?: { value: { __typename: string; percentage?: number; amount?: { amount: string } } };
    minimumRequirement?: { __typename: string; greaterThanOrEqualToSubtotal?: { amount: string } } | null;
  };
};

async function importDiscounts(list: SDiscount[]) {
  let created = 0;
  for (const d of list) {
    const x = d.discount;
    if (x.__typename !== "DiscountCodeBasic") {
      console.log(`  Skipped ${x.title ?? d.id} (${x.__typename} isn't supported; recreate it in Admin > Coupons).`);
      continue;
    }
    const code = x.codes?.nodes[0]?.code?.toUpperCase();
    if (!code || DRY) continue;
    const pct = x.customerGets?.value.__typename === "DiscountPercentage" ? Math.round((x.customerGets.value.percentage ?? 0) * 100) : null;
    const amt = x.customerGets?.value.__typename === "DiscountAmount" ? dollars(x.customerGets.value.amount?.amount) : null;
    const r = await db
      .insert(schema.coupons)
      .values({
        code,
        description: `Imported from Shopify (${x.title})`,
        percentOff: pct,
        amountOffCents: amt,
        duration: "once",
        maxRedemptions: x.usageLimit ?? null,
        minimumCents: x.minimumRequirement?.greaterThanOrEqualToSubtotal ? dollars(x.minimumRequirement.greaterThanOrEqualToSubtotal.amount) : null,
        expiresAt: x.endsAt ? new Date(x.endsAt) : null,
        active: x.status === "ACTIVE",
        timesRedeemed: x.asyncUsageCount ?? 0,
        shopifyId: d.id,
      })
      .onConflictDoNothing()
      .returning({ id: schema.coupons.id });
    if (r.length) created++;
  }
  console.log(`Coupons: ${created} new. Open Admin > Coupons and press Publish on each to make it work at checkout.`);
}

async function main() {
  console.log(DRY ? "DRY RUN: nothing will be written.\n" : "Importing…\n");
  const productsFile = SNAPSHOT_ONLY ? null : read<{ products: SProduct[] }>("products.json");
  const products = productsFile ?? read<{ products: SProduct[] }>("products.snapshot.json");
  if (!products) throw new Error("No products.json or products.snapshot.json in migration/data.");
  if (!productsFile) console.log("Using the catalog snapshot (run shopify:export for the live catalog).");
  await importProducts(products.products);
  if (SNAPSHOT_ONLY) return;

  const customers = read<{ customers: SCustomer[] }>("customers.json");
  const orders = read<{ orders: SOrder[] }>("orders.json");
  const discounts = read<{ discounts: SDiscount[] }>("discounts.json");
  if (!customers || !orders) {
    console.log("\ncustomers.json / orders.json not found. Run `npm run shopify:export` first. Catalog was imported.");
    return;
  }
  await importCustomers(customers.customers);
  await importOrders(orders.orders);
  if (discounts) await importDiscounts(discounts.discounts);

  if (!DRY) {
    const [check] = (
      (await db.execute(sql`select count(*)::int as n, coalesce(sum(total_cents),0)::bigint as t from orders where source = 'shopify' and status in ('paid','partially_refunded','refunded')`)) as unknown as {
        rows: { n: number; t: string }[];
      }
    ).rows;
    console.log(`\nVerify: ${check?.n} paid Shopify orders in the database, $${(Number(check?.t ?? 0) / 100).toFixed(2)} total.`);
    console.log("Compare with Shopify Analytics > Total sales (it was $1,812 on 2 Oct 2026 across 74 orders including 1 voided).");
  }
}

main()
  .then(() => conn?.close())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
