/**
 * Exports everything from Shopify into migration/data/*.json.
 *
 *   SHOPIFY_STORE_DOMAIN=mesg2c-g0.myshopify.com SHOPIFY_ADMIN_TOKEN=shpat_... npm run shopify:export
 *
 * Token: Shopify admin > Settings > Apps and sales channels > Develop apps > Create an app >
 * Admin API scopes: read_products, read_inventory, read_orders, read_all_orders, read_customers, read_discounts.
 * (read_all_orders is needed for orders older than 60 days.)
 *
 * Run it once to test, and again right before switching the domain so no late orders are missed.
 * The output contains customer personal data and is git-ignored. Do not commit it.
 */
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config();

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
if (!DOMAIN || !TOKEN) {
  console.error("Set SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN (see the comment at the top of this file).");
  process.exit(1);
}
const OUT = join(process.cwd(), "migration", "data");
mkdirSync(OUT, { recursive: true });

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://${DOMAIN}/admin/api/${VERSION}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-shopify-access-token": TOKEN! },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    const body = (await res.json()) as { data?: T; errors?: unknown };
    if (body.errors) {
      const msg = JSON.stringify(body.errors);
      if (msg.includes("THROTTLED")) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new Error(`Shopify GraphQL error: ${msg}`);
    }
    return body.data as T;
  }
  throw new Error("Shopify kept throttling. Wait a minute and run again.");
}

type Page<N> = { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: N[] };

async function all<N>(label: string, query: string, root: string): Promise<N[]> {
  const out: N[] = [];
  let after: string | null = null;
  do {
    const data: Record<string, Page<N>> = await gql(query, { after });
    const page: Page<N> = data[root]!;
    out.push(...page.nodes);
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    process.stdout.write(`\r${label}: ${out.length}`);
  } while (after);
  process.stdout.write("\n");
  return out;
}

const PRODUCTS = `query Products($after: String) { products(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes {
  id handle title status descriptionHtml createdAt tags productType options { name }
  variants(first: 100) { nodes { id title sku price position inventoryQuantity inventoryItem { tracked unitCost { amount } } selectedOptions { name value } } }
  media(first: 20) { nodes { ... on MediaImage { image { url altText } } } } } } }`;

const CUSTOMERS = `query Customers($after: String) { customers(first: 100, after: $after) { pageInfo { hasNextPage endCursor } nodes {
  id firstName lastName createdAt note tags numberOfOrders amountSpent { amount }
  defaultEmailAddress { emailAddress marketingState marketingUpdatedAt } defaultPhoneNumber { phoneNumber }
  defaultAddress { address1 address2 city provinceCode zip countryCodeV2 } } } }`;

const ORDERS = `query Orders($after: String) { orders(first: 50, after: $after, sortKey: CREATED_AT) { pageInfo { hasNextPage endCursor } nodes {
  id name createdAt processedAt cancelledAt email phone note tags displayFinancialStatus displayFulfillmentStatus
  customer { id } discountCodes
  subtotalPriceSet { shopMoney { amount } } totalDiscountsSet { shopMoney { amount } } totalTaxSet { shopMoney { amount } }
  totalShippingPriceSet { shopMoney { amount } } totalPriceSet { shopMoney { amount } } totalRefundedSet { shopMoney { amount } }
  shippingLine { title source } shippingAddress { name address1 address2 city provinceCode zip countryCodeV2 }
  lineItems(first: 50) { nodes { title variantTitle quantity sku variant { id } product { id }
    originalUnitPriceSet { shopMoney { amount } } discountedTotalSet { shopMoney { amount } } sellingPlan { name } } }
  transactions(first: 20) { gateway kind status amountSet { shopMoney { amount } } fees { amount { amount } } } } } }`;

const DISCOUNTS = `query Discounts($after: String) { discountNodes(first: 50, after: $after) { pageInfo { hasNextPage endCursor } nodes {
  id discount { __typename ... on DiscountCodeBasic { title status startsAt endsAt usageLimit asyncUsageCount appliesOncePerCustomer
    codes(first: 10) { nodes { code } }
    customerGets { value { __typename ... on DiscountPercentage { percentage } ... on DiscountAmount { amount { amount } appliesOnEachItem } } }
    minimumRequirement { __typename ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount } } } } } } } }`;

async function main() {
  const exportedAt = new Date().toISOString();
  const products = await all("Products", PRODUCTS, "products");
  const customers = await all("Customers", CUSTOMERS, "customers");
  const orders = await all("Orders", ORDERS, "orders");
  const discounts = await all("Discounts", DISCOUNTS, "discountNodes");
  const write = (name: string, data: unknown) => writeFileSync(join(OUT, name), JSON.stringify({ exportedAt, ...(data as object) }, null, 1));
  write("products.json", { products });
  write("customers.json", { customers });
  write("orders.json", { orders });
  write("discounts.json", { discounts });
  console.log(`\nDone. Wrote ${products.length} products, ${customers.length} customers, ${orders.length} orders, ${discounts.length} discounts to migration/data/.`);
  console.log("Next: npm run shopify:import");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
