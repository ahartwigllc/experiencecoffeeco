# Deployment and cutover

Follow these in order. Sections 1–7 can be done while Shopify keeps running; nothing customer-facing changes until section 9. Plan about an afternoon for 1–7 and an hour for the cutover.

You'll create these secrets along the way. Keep them in a password manager.

| Name | Where it comes from | Used for |
| --- | --- | --- |
| `DATABASE_URL` | Neon (section 2) | The database |
| `SESSION_SECRET` | You generate it (below) | Signing logins and unsubscribe links |
| `SETUP_TOKEN` | You generate it | One-time owner account creation |
| `STRIPE_SECRET_KEY` | Stripe (section 3) | Payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe (section 6) | Verifying Stripe's notifications |
| `RESEND_API_KEY` | Resend (section 4) | Email |
| `SHOPIFY_ADMIN_TOKEN` | Shopify (section 8) | Exporting your data, once |

Generate random secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## 1. GitHub

1. Create a **private** repository, for example `experience-coffee`.
2. Unzip this project, then from its folder:
   ```bash
   git init
   git add .
   git commit -m "Experience Coffee site"
   git branch -M main
   git remote add origin git@github.com:YOUR-USER/experience-coffee.git
   git push -u origin main
   ```
3. `.gitignore` already excludes `.env*`, `.dev.vars`, and the Shopify customer data in `migration/data/`. Never commit those.

## 2. Database (Neon)

1. Sign up at neon.tech and create a project.
   - **Region: AWS US East (N. Virginia)**, close to New Jersey and to Cloudflare's busiest data centers.
   - Postgres version: the default.
2. On the project dashboard, press **Connect**, turn on **Connection pooling**, and copy the connection string. It looks like `postgresql://USER:PASSWORD@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`. This is your `DATABASE_URL`.
3. On your computer, in the project folder:
   ```bash
   npm install
   cp .env.example .env.local
   # edit .env.local: DATABASE_URL, SESSION_SECRET, SETUP_TOKEN
   npm run db:push      # creates every table
   npm run db:seed      # loads your 5 products from the snapshot
   ```
4. **How the free plan behaves:**
   - The database sleeps after 5 minutes without queries and wakes by itself on the next visit. That first visit is a fraction of a second slower; nothing goes offline.
   - The free plan includes **100 compute hours per month**, counted only while the database is awake. Check Neon > Usage after your first month live. If you're near the cap, the Launch plan is usage-based with no monthly minimum and lets you turn off sleeping.
   - **Backups:** free includes 6 hours of restore history (undo a mistake from earlier the same day). Paid plans keep more. Also do the monthly CSV exports in section 11.
   - Storage: 1 GB per project. Your entire Shopify history is under 1 MB.

## 3. Stripe

1. Create or open your Stripe account. Under **Settings > Business**, finish verification.
2. **Settings > Payouts**: add the business bank account. This is where your money lands.
3. **Developers > API keys**: copy the **test** secret key (`sk_test_…`) into `.env.local` as `STRIPE_SECRET_KEY`. Use live keys only at cutover.
4. **Settings > Billing > Customer portal**: turn on
   - Cancel subscriptions (at end of period)
   - Pause subscriptions
   - Update payment methods
   - Invoice history

   Leave "switch plans" off. Set the business name, privacy, and terms links (`https://experiencecoffee.co/policies/privacy` and `/policies/terms`). Do this in test mode and again in live mode.
5. **Settings > Branding**: upload the logo, and set the brand color to `#8E1C2E` and the accent to `#DDE2D0` so checkout matches the site.
6. Optional: **Stripe Tax**. Only if your accountant says you must collect NJ sales tax. Turn it on in Stripe, add your NJ registration, then set Admin > Settings > Sales tax to "Calculate with Stripe Tax" and add a tax code on each product.

## 4. Email (Resend)

1. Sign up at resend.com and add the domain `experiencecoffee.co`.
2. Resend shows DNS records: SPF (TXT), DKIM (TXT or CNAME), and a return-path MX. You'll add them in Cloudflare DNS in section 5. Also add a DMARC record:
   `TXT  _dmarc  v=DMARC1; p=none; rua=mailto:ahartwigllc@gmail.com`
3. Create an API key with "sending access" and put it in `RESEND_API_KEY`.
4. `EMAIL_FROM` defaults to `Experience Coffee <hello@experiencecoffee.co>`. Replies go to the support email set in Admin > Settings, so you don't need a real inbox at `hello@`.

## 5. Cloudflare: DNS first, without breaking Shopify

1. Create a Cloudflare account and **Add a site**: `experiencecoffee.co` (free plan).
2. Cloudflare scans your current DNS. **Check that it found the Shopify records** before going further. Typically:
   - `A  @  23.227.38.65`
   - `CNAME  www  shops.myshopify.com`

   Set both to **DNS only** (grey cloud) for now. Shopify needs that to keep its certificate.
3. Add the Resend records from section 4.
4. Find where the domain is registered:
   - If you bought it **through Shopify**: Shopify admin > Settings > Domains > the domain > Transfer, and transfer it to Cloudflare Registrar (takes up to 5 days), or change nameservers from that screen if offered.
   - If you bought it elsewhere (GoDaddy, Namecheap…): change the nameservers there to the two Cloudflare gives you.
5. Wait until Cloudflare says the site is **Active**. Shopify still serves the store; nothing has changed for customers.

## 6. Cloudflare: deploy the app to a test address

**Option A, deploy from GitHub (recommended).**
1. Cloudflare dashboard > Workers & Pages > Create > **Import a repository**, then pick the GitHub repo.
2. Build command: `npx opennextjs-cloudflare build`. Deploy command: `npx opennextjs-cloudflare deploy`.
3. Settings > Variables and secrets, then add as **secrets**: `DATABASE_URL`, `SESSION_SECRET`, `SETUP_TOKEN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (placeholder for now), `RESEND_API_KEY`.
4. Change `SITE_URL` in `wrangler.jsonc` to your `*.workers.dev` address while testing; set it back to `https://experiencecoffee.co` at cutover.

**Option B, deploy from your computer.**
```bash
npx wrangler login
npx wrangler secret put DATABASE_URL     # repeat for each secret
npm run cf:deploy
```

Then:
1. **Stripe webhook**: Developers > Webhooks > Add endpoint: `https://YOUR-WORKER.workers.dev/api/webhooks/stripe`, with these events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `charge.refunded`.
   Copy the signing secret (`whsec_…`) into the `STRIPE_WEBHOOK_SECRET` secret and redeploy.
2. **Owner account**: visit `/admin/setup`, enter the `SETUP_TOKEN`, and create the account. Then delete the `SETUP_TOKEN` secret.
3. **Settings**: Admin > Settings. Check addresses, the delivery ZIP list, and the subscription discount. Add Instagram/TikTok links.
4. **Costs**: Admin > Products, then enter a unit cost for every option. Profit numbers depend on this.
5. **Team**: Admin > Team. Add G as an owner, and any helpers as staff with their hourly wage.

The first build is the first time the whole app compiles with real packages (see BUILD_LOG, "Verification"). If the build log shows a type error, it will be small and local; fix it or paste it to Claude Code.

## 7. Rehearsal in test mode

Use Stripe test card `4242 4242 4242 4242`, any future date, any CVC. Tick each:

- [ ] Buy a 12oz bag for **pickup**. The order appears in Admin > Orders with the Stripe fee filled in, the customer gets a receipt, and you get the new-order email.
- [ ] Buy for **local delivery** with ZIP 07071. Try ZIP 10001: the cart blocks it.
- [ ] Subscribe to the Cold Brew Box **every 2 weeks**. The price shows 20% off ($20), and it appears in Admin > Subscriptions.
- [ ] Renewal: Stripe test mode > Billing > **Test clocks** > create a clock, add a customer to it, and give that customer a subscription to any recurring price from the dashboard. Advance the clock by one period. A renewal order (source "subscription renewal") appears in Admin > Orders. Its first payment won't appear as an order, because it didn't go through the website checkout; that's expected.
- [ ] From `/account` (sign-in link by email), open **Manage subscriptions** and pause, then cancel.
- [ ] Create coupon `TEST10` in Admin > Coupons and use it at checkout.
- [ ] **Refund** an order from its admin page. Stripe shows the refund, and the order shows refunded.
- [ ] Mark an order **ready for pickup** with "Email customer" checked.
- [ ] **Record an order** by hand (cash), then check it lowers stock.
- [ ] Clock in, wait a minute, clock out. Check Time clock and Profit and taxes.
- [ ] Sign up for the newsletter in the footer and confirm from the email.
- [ ] Create an email campaign, send a test to yourself, and click unsubscribe.
- [ ] Try the old links `/collections/all` and `/pages/contact`. Both redirect.

## 8. Final data export (cutover day, start)

1. In Shopify: Settings > Apps and sales channels > Develop apps > **Create an app** ("Migration"). Admin API scopes: `read_products`, `read_inventory`, `read_orders`, `read_all_orders`, `read_customers`, `read_discounts`. Install it and copy the Admin API access token.
2. On your computer, with `.env.local` pointing at the **production** database:
   ```bash
   SHOPIFY_ADMIN_TOKEN=shpat_xxx npm run shopify:export
   npm run shopify:import -- --dry-run      # check the summary
   npm run shopify:import
   ```
   The import prints a verification line. It should match Shopify Analytics total sales ($1,812 across 74 orders on 2 Oct 2026, plus anything since).
3. Optional: copy `migration/legacy-costs.example.json` to `migration/legacy-costs.json` and fill in costs for the early 8oz bags before importing, so historic profit is accurate.
4. Download product photos off Shopify's servers, then commit and push:
   ```bash
   npm run images:download
   git add public/images && git commit -m "Product photos" && git push
   ```
5. Admin > Coupons: press **Publish** on LEOM (and any other imported codes).

## 9. Switch to live and move the domain

1. Stripe **live mode**:
   - Copy the live secret key into `STRIPE_SECRET_KEY`.
   - Create the same webhook endpoint at `https://experiencecoffee.co/api/webhooks/stripe` and copy its live secret into `STRIPE_WEBHOOK_SECRET`.
   - Repeat the customer portal settings.
2. Set `SITE_URL` to `https://experiencecoffee.co` in `wrangler.jsonc` and redeploy.
3. Coupons created in test mode don't exist in live mode: in the database, clear `stripe_coupon_id` and `stripe_promotion_code_id` on each coupon, then press Publish again. (Or delete the test coupons and recreate them.)
4. Cloudflare > the worker > Settings > Domains & Routes > **Add custom domain**: `experiencecoffee.co`, and again for `www.experiencecoffee.co`. Cloudflare replaces the Shopify A/CNAME records. If it complains they exist, delete those two records first.
5. Within a few minutes the domain serves the new site with HTTPS. Place one real order with your own card, then refund it.

## 10. Move subscribers and close Shopify

1. Admin > Subscriptions > "Subscribers from the old Shopify store": press **Send invite** for each person. Each email links straight to their coffee with the same schedule pre-selected and the same 20% price.
2. In your Shopify subscription app, **cancel each person's Shopify subscription** as they restart here, or on a fixed date you mention in a personal note. Nobody should be billed twice.
   - Alternative: Shopify can transfer saved cards to Stripe for PCI-compliant migrations. Ask Shopify Support for a "payment data export to Stripe" and Stripe Support for a "card data import." Use this only if you'd rather not ask subscribers to re-enter a card; with about six subscribers, invites are simpler.
3. Keep Shopify for 30 days on the cheapest **pause** plan. You keep admin access to old reports, and nothing sells there.
4. Download Shopify's own CSV exports (Orders, Customers, Products) for your records, then close the store.

## 11. Ongoing

- **Updates**: push to `main` and Cloudflare rebuilds.
- **Backups**: Neon's restore history (6 hours on free, longer on paid plans). Monthly, also export orders, customers, and the P&L CSV from the admin.
- **Rate limiting**: Cloudflare > Security > WAF > Rate limiting rules. Add one for `/api/*` at 30 requests per minute per IP.
- **Errors**: Cloudflare > the worker > Logs (observability is enabled in `wrangler.jsonc`).
- **Stripe API version** is pinned (`2024-06-20`, in `src/lib/stripe.ts`). Upgrade deliberately, not by accident.
