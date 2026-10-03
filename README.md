# Experience Coffee

The storefront, subscriptions, and back office for experiencecoffee.co, replacing Shopify.

- **Storefront**: shop, product pages with size/grind and subscribe-and-save, cart with pickup or local delivery, Stripe checkout, customer accounts (emailed sign-in links), newsletter with double opt-in.
- **Payments**: Stripe Checkout and Stripe Billing. Money goes to the bank account connected to your Stripe account. Coupons are Stripe promotion codes.
- **Back office** (`/admin`): orders and fulfillment, refunds, products with costs and margins, inventory, customers, subscriptions, coupons, time clock, expenses, profit and taxes (P&L, profit per hour, by month), email campaigns, team, settings.
- **Migration**: scripts that copy every product, customer, order, and discount code out of Shopify.

## Where to start

| You want to… | Read |
| --- | --- |
| Understand the whole plan | [docs/PLAN.md](docs/PLAN.md) |
| See what was built and every judgement call made | [docs/BUILD_LOG.md](docs/BUILD_LOG.md) |
| Put it online (Cloudflare, GitHub, database, Stripe, email, domain) | [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) |
| Learn the admin day to day | [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md) |

## Quick start (local)

```bash
npm install
cp .env.example .env.local     # Neon DATABASE_URL, SESSION_SECRET, Stripe test keys
npm run db:push                # create tables
npm run db:seed                # load your real catalog from the snapshot
npm run admin:create -- you@example.com "Your Name" "a-long-password"
npm run dev                    # http://localhost:3000 and /admin
npm run stripe:listen          # in a second terminal, forwards Stripe webhooks
npm test                       # unit tests
```

## Stack

Next.js 15 (App Router) on Cloudflare Workers via OpenNext · Postgres (Neon) with Drizzle ORM · Stripe · Resend · no CSS framework (one hand-written stylesheet).

## Layout

```
src/app/(store)/     public site
src/app/admin/       back office (login, setup, panel pages, server actions)
src/app/api/         checkout, Stripe webhook, newsletter, contact, account links, unsubscribe
src/lib/             business logic (pricing, checkout, stripe-sync, finance, email, auth…)
src/db/schema.ts     database tables
migration/           Shopify export/import scripts and data (data is git-ignored)
tests/               unit tests (node:test)
docs/                plan, build log, deployment, admin guide
```
