# Plan: replacing Shopify for Experience Coffee

## 1. Goals

1. Keep **experiencecoffee.co**, with no downtime and no broken links.
2. Take payments with **Stripe**, paid out to the business bank account, including **recurring subscriptions** and **coupon codes**.
3. An **admin panel** that calculates **taxes, fees, cost of goods, labor (hourly clock-in/out), and profit per hour and per month**.
4. Bring over **all order, customer, and product history**.
5. **Email marketing**: newsletter sign-up on the site and campaigns to subscribers.

## 2. What the audit found (2 Oct 2026)

| Area | Finding | Consequence for the build |
| --- | --- | --- |
| Catalog | 5 products (4 active), 29 options, sizes 12oz/2lb/5lb × 4 grinds | Size + grind variant model; same product URLs kept |
| Orders | 74 orders, Feb–Oct 2026, $1,872 gross / $1,812 net | Import all; order numbers continue from #10xx |
| Customers | 40, all opted in to marketing | All 40 imported as confirmed email subscribers |
| Fulfillment | Only local delivery and pickup at 523 Anthony Ct. Never shipped | Pickup + delivery-by-ZIP are primary; shipping exists but is off |
| Tax | $0 sales tax ever collected | Tax off by default; Stripe Tax one switch away |
| Fees | Shopify Payments ≈ 2.9% + 30¢; early orders were cash on delivery | Actual Stripe fee recorded per order; cash orders fee $0 |
| Subscriptions | 20% off; Weekly, Bi-Weekly, Monthly; ~6 active subscribers via a Shopify app | Same discount and schedules; invite flow to move subscribers |
| Discounts | LEOM (100% off, active). WEEKLY used once, since deleted | LEOM imported; recreate others in Admin > Coupons |
| Costs | No unit costs entered in Shopify | Cost per option is a first-class field; dashboard nags until filled |
| Inventory | Cold Brew at −55 (not really tracked) | Cold Brew is made-to-order (no stock limit) |
| Footer | Social links pointed at Shopify's own accounts | Replaced with your links from Settings (hidden until set) |

## 3. Architecture

```
Browser ──► Cloudflare Worker (Next.js via OpenNext) ──► Neon Postgres
                 │        ▲
                 │        └── Stripe webhooks (orders, renewals, refunds, fees)
                 ├──► Stripe Checkout / Billing / Customer Portal
                 └──► Resend (receipts, sign-in links, campaigns)
```

- **Prices are never trusted from the browser.** The cart sends variant ids and quantities; the server looks up prices, applies the subscription discount, checks stock and the delivery ZIP, and builds the Stripe session.
- **Orders are created by the webhook**, not the success page, so an order exists even if the customer closes the tab. Every handler is idempotent (events are recorded; Stripe ids are unique).
- **Subscriptions** are Stripe subscriptions. Renewals arrive as `invoice.paid` and become new orders automatically (source "subscription"). Customers manage cards, skip, pause, and cancel in Stripe's hosted portal.
- **Money is integer cents. Reports use New York time** for "today" and "this month".

## 4. Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Audit Shopify (catalog, orders, customers, discounts, settings) | Done |
| 2 | Data model and core logic (pricing, checkout, webhook sync, finance) | Done |
| 3 | Storefront | Done |
| 4 | Admin panel (all sections) | Done |
| 5 | Migration tooling (export, import, images, admin creation) | Done |
| 6 | Tests and static verification | Done (see BUILD_LOG) |
| 7 | Documentation | Done |
| 8 | **Your part:** connect GitHub, Cloudflare, Neon, Stripe, Resend; first build | To do — DEPLOYMENT.md |
| 9 | **Your part:** test-mode rehearsal on a preview URL | To do — DEPLOYMENT.md §7 |
| 10 | **Your part:** cutover: final export/import, move subscribers, switch DNS, close Shopify | To do — DEPLOYMENT.md §8–10 |

## 5. How each requirement is met

**Stripe payments to your bank.** Stripe Checkout (hosted, so no card data touches your site). Payouts go to the bank account set in Stripe > Settings > Payouts.

**Recurring subscriptions.** Subscribe-and-save on every product (toggle per product), 20% off by default, weekly / every 2 weeks / monthly. Customers manage everything themselves in the Stripe portal from their account page. You can pause, resume, or cancel from Admin > Subscriptions.

**Coupon codes.** Admin > Coupons creates the Stripe coupon and the customer-facing code together. Percent or dollar off, first order only, minimum order, usage limits, expiry, and for subscriptions: first payment, first N months, or forever. Customers enter codes on the Stripe payment page.

**Taxes.** Sales tax: off (matching Shopify history) or Stripe Tax. Every order records tax collected; Finance shows it by month. Income tax: an estimated set-aside (default 25% of profit, adjustable) and the quarterly due dates. Not tax advice; the CSV export is for your accountant.

**Fees.** The real Stripe fee for each charge is stored on the order (pulled from Stripe's balance transaction). A "Fetch fees now" button fills any that were late. Imported Shopify fees use Shopify's recorded fee, or a 2.9% + 30¢ estimate when Shopify didn't report one.

**Cost.** Every size/grind option has a unit cost. Each sale snapshots the cost so changing it later doesn't rewrite history. Alternatively, count green coffee and packaging purchases as cost of goods when bought (Settings).

**Hourly check-in/out.** Admin > Time clock. Staff accounts only see the time clock. Owners can fix missed punches, clock people out, see hours and labor cost per person, and export a payroll CSV. Wages are snapshotted per shift.

**Profit per hour and per month.** Admin > Profit and taxes: a full P&L (gross sales → net profit → take-home after tax set-aside), month-by-month table and chart, profit and revenue per hour worked, and product margins.

**History migration.** `npm run shopify:export` then `npm run shopify:import`. Re-runnable without duplicates. Former subscribers appear in Admin > Subscriptions with a one-click invite to restart.

**Email marketing.** Newsletter forms in the footer and home page (double opt-in). Campaign editor with preview, test send, and batch sending through Resend; every email has your postal address and one-click unsubscribe (CAN-SPAM, Gmail/Yahoo bulk-sender rules).

## 6. Costs to expect (approximate, check current pricing)

- Cloudflare Workers: free tier likely enough; paid plan is about $5/month.
- Neon: the free plan can run the live store (it sleeps when idle but wakes automatically). Watch the 100 compute-hours/month; the paid Launch plan is usage-based with no monthly minimum.
- Stripe: 2.9% + 30¢ per card charge, plus Stripe Billing's percentage on subscription revenue (0.7% at the time of writing); Stripe Tax adds a per-transaction fee if turned on.
- Resend: free tier covers 3,000 emails/month.
- Compared with Shopify Basic plus a subscription app, this is typically cheaper, but your time maintaining it is the real cost.
