# Build log

## Phases

| Phase | What happened |
| --- | --- |
| 1. Audit | Read experiencecoffee.co and the Shopify admin through the Shopify connector: shop info, all 5 products with variants, inventory, and images; orders (first 50 in full detail, counts and totals for all 74); customer counts and marketing consent; discounts; monthly sales analytics. Findings are in PLAN.md §2. |
| 2. Core | Database schema (19 tables), pricing rules, checkout builder, Stripe webhook sync, finance engine, auth, email. |
| 3. Storefront | Home, shop, product, cart, checkout success, account, sign-in, newsletter confirm, unsubscribe, contact, policies, 404, sitemap, robots, legacy redirects. |
| 4. Admin | Dashboard, orders (list, detail, manual entry, CSV), products, customers (CSV), subscriptions (incl. legacy invites), coupons, profit and taxes (CSV), expenses, time clock (CSV), email marketing (campaigns, subscribers, CSV), messages, team, settings, login, first-run setup. |
| 5. Migration | Shopify export (GraphQL queries validated against Shopify's live schema), idempotent import, image download, owner-account script, catalog snapshot. |
| 6. Verification | See below. |
| 7. Docs | README, PLAN, DEPLOYMENT, ADMIN_GUIDE, this log. |

## Verification

**Done in the build environment:**

- **24 unit tests pass** (`npm test`). They cover:
  - subscription pricing against real Shopify history ($25 → $20, $10 → $8);
  - interval mapping from Shopify plan names and Stripe;
  - cart rules and delivery ZIPs;
  - MRR math;
  - P&L math, including losses and zero hours;
  - fee estimate against observed Shopify fees ($20 → $0.88);
  - Markdown escaping, including `javascript:` links;
  - password hashing, and signed-token tampering and expiry;
  - CSV escaping with spreadsheet-formula protection;
  - New York timezone month and day bounds across DST;
  - the Shopify description parser against your actual product descriptions.
- **Static analysis of all 123 source files:**
  - every file parses;
  - every local import resolves to a real file and a real exported name;
  - page and layout files only export what Next.js allows;
  - `"use server"` files only export async functions;
  - no client component imports server-only modules.
- **Type check against stub declarations** for the external packages. This caught one real issue, `Uint8Array` typing for newer TypeScript in `crypto.ts`, which was fixed. All remaining reports were artifacts of the stubs.
- **Visual review:** the home page was rendered with the real stylesheet at desktop and phone widths. This caught and fixed a coffee-list alignment bug and the price wrapping badly on phones.
- **Shopify queries:** the export queries were validated with Shopify's schema validator. Two deprecated fields were replaced with their current equivalents.

**Not possible here (no internet in the build sandbox):**

- `npm install`, `next build`, and running against real Stripe, Neon, or Resend. The first build on your machine or on Cloudflare is the first full compile. Expect at most a few small type fixes, most likely around Stripe or Drizzle type details. The Stripe API version and package versions are pinned to reduce this.
- Real fonts in the visual review (Archivo and Source Serif load from Google Fonts in production).

## Assumptions & Decisions

Each was a judgement call made without asking, choosing the safest reasonable option.

### Platform

1. **Next.js 15 on Cloudflare Workers** (via OpenNext), because you said you'll link Cloudflare. It also runs on any Node host (Vercel, Render) without changes.
2. **Postgres on Neon**, through Neon's HTTP driver. (Supabase was tried and set aside: its free plan takes the database offline after a week of low activity until it's restored by hand. Neon's free plan sleeps after 5 minutes but wakes automatically on the next request.)
   - The driver is stateless, one HTTPS request per query, so it works identically on Workers, Node, and scripts, with no connection pooling or Hyperdrive needed.
   - Trade-off: no multi-statement transactions. Writes use single-statement updates, unique constraints, and idempotent upserts, so correctness doesn't depend on transactions.
   - Watch the free plan's 100 compute-hours/month after launch; every page view reads the database.
3. **Stripe hosted Checkout and Customer Portal**, not custom card forms. This keeps your PCI scope minimal and gives Apple Pay/Google Pay for free.
4. **Stripe API pinned to `2024-06-20`** with `stripe@16`, so field shapes don't change underneath the code.
5. **Resend for email** over fetch (no SDK). When the key is missing, emails are logged and skipped so development never blocks.
6. **No CSS framework.** One stylesheet, so the design is specific to the brand and there are fewer dependencies to break.

### Pricing and checkout

7. **Subscription discount is 20%**, matching Shopify history. It's set per store in Settings, and each product can turn subscriptions on or off.
8. **Schedules are weekly, every 2 weeks, and monthly**, matching the three Shopify selling plans seen in orders.
9. **One schedule per checkout.** Stripe requires one billing interval per subscription. Mixed schedules show a clear message; one-time items can ride along with a subscription.
10. **Prices are sent to Stripe inline (`price_data`)** from the database at checkout, instead of syncing a Stripe product catalog. There's one source of truth and no drift.
11. **Sales tax is off by default**, because Shopify collected $0 on all 74 orders and NJ generally exempts grocery coffee. Stripe Tax is one setting away. **Confirm with your accountant, especially for the cold brew box.**
12. **Delivery area:** the ZIPs from past delivery orders plus nearby towns: 07071 Lyndhurst, 07070 Rutherford, 07072 Carlstadt, 07073 East Rutherford, 07110 Nutley, 07512 Totowa, 07031 North Arlington, 07111 Irvington, 07032 Kearny, 07012 Clifton. It's editable. The ZIP is checked before checkout, and again against the address entered at Stripe; mismatches are flagged "needs review".
13. **Delivery fee is $0** (Shopify charged nothing). For subscriptions with a fee, the fee becomes a recurring line, because Stripe doesn't allow shipping rates on subscriptions.
14. **Shipping is built but off**, since nothing has ever shipped. Flat $8, free over $50 when enabled.
15. **Cold Brew is made-to-order** (no stock limit), since Shopify showed −55 stock. Beans track stock. Negative stock imports as 0.
16. **Discount codes are entered on Stripe's page** (`allow_promotion_codes`), not in the cart. That's less code and Stripe enforces all the limits.

### Data and migration

17. **Product URLs are unchanged**, and old Shopify paths (`/collections/all`, `/pages/contact`, `/policies/*`, `/account/*`) redirect permanently. This protects search ranking and links.
18. **Order numbers continue from Shopify's** (#1001…); new orders take the next number.
19. **Flavor notes, process, cupping score, and origin** are parsed out of the Shopify descriptions into their own fields, and those label lines are removed from the description text so they aren't shown twice. Origin is country-level; refine it in the admin.
20. **The Peru lot is featured on the home page**, since it has the highest cupping score and the most expressive notes. Change it with the "Feature on the home page" checkbox.
21. **All 40 Shopify customers become confirmed email subscribers**, because Shopify shows every one as SUBSCRIBED. Anyone not marked subscribed would not be added.
22. **Shopify fees:** the recorded fee when present. When Shopify didn't report one, it's estimated at 2.9% + 30¢ and noted on the order. Cash-on-delivery orders have a fee of $0.
23. **Early 8oz bags no longer exist as products**, so their history has no unit cost. The optional `migration/legacy-costs.json` fills that in; otherwise Finance flags them as missing cost.
24. **Coupons import as "once"** (one order, or the first payment of a subscription) and need a Publish click in Admin > Coupons. LEOM is 100% off; consider whether it should stay public.
25. **Shopify subscriptions can't be moved automatically** (the cards sit with Shopify and the contracts weren't readable through the connector). Former subscribers are inferred from order history, with a one-click invite to restart at the same price. The PCI card-migration route is documented as an alternative.
26. **Product photos still point at Shopify's CDN** until `npm run images:download` copies them into the site. This must happen before Shopify closes.
27. **Exported customer data is git-ignored.** The catalog snapshot contains no personal data and is committed.

### Finance

28. **Revenue excludes sales tax.** It's a liability, shown separately.
29. **Two cost-of-goods methods.** "Unit cost × units sold" is the default and more accurate month to month. The alternative counts "Green coffee/packaging purchases when bought". In unit-cost mode those purchases aren't subtracted again, which avoids double counting.
30. **Each sale snapshots unit cost**, so cost changes don't rewrite history. Imported orders fall back to the option's current cost.
31. **Labor = hours × wage, snapshotted per shift.** Owners at $0/hour still count toward hours, so profit per hour reflects all time spent.
32. **Refunds count in the month of the original order**, not the month refunded. This is simpler, and consistent for a small store.
33. **The income tax set-aside defaults to 25% of positive profit**, as a planning estimate only. The page says it isn't tax advice.
34. **Months follow New York time** (`APP_TIMEZONE`).

### Accounts, security, email

35. **Admin accounts:**
    - Passwords are hashed with PBKDF2-SHA256 at 100k iterations (the maximum Workers supports).
    - Sessions last 12 hours in signed HTTP-only cookies.
    - Login does a constant-time comparison even for unknown emails.
36. **Two roles.** Owner (everything) and staff (time clock only). There must always be one active owner, and you can't demote yourself.
37. **Customers sign in with one-time email links.** Shopify passwords can't be exported anyway.
    - Links expire after 30 minutes and work once.
    - A sign-in needs a button press, so email link scanners can't use up the link.
    - At most 3 links per email per 15 minutes.
    - The response never reveals whether an email has an account.
38. **Newsletter uses double opt-in.** Admin bulk-add is allowed without confirmation only with an explicit "they told me yes" checkbox. **Unsubscribed people can never be re-added from the admin.**
39. **Every campaign includes the postal address and an unsubscribe link**, plus RFC 8058 one-click unsubscribe headers (CAN-SPAM, Gmail/Yahoo bulk-sender rules). The pickup address is the default postal address because it's already public on the site; a PO box can replace it in Settings.
40. **First owner creation:** `/admin/setup` with a one-time `SETUP_TOKEN`, which only works while no accounts exist, or the `admin:create` script.
41. **Protections:**
    - CSRF: same-origin checks on API routes; server actions have Next's built-in origin check.
    - Honeypot fields on public forms.
    - Admin pages are `noindex` and can't be framed.
    - Formula-injection protection on CSV exports.
42. **Product descriptions render as HTML.** Only the owner can edit them, and they came from Shopify; they are not user input.
43. **Policy pages are starter text** written for this business. Review them, and have a lawyer look at Terms and Privacy if you want certainty.

### Design

44. **Visual identity comes from the coffee plant, not the roast:**
    - green-bean sage background `#DDE2D0`;
    - cherry-skin red `#8E1C2E`;
    - fermentation honey `#D9A441`;
    - roast ink `#2A1A14`.

    Type is Archivo (expanded) with Source Serif 4. The signature element is the **tasting line**: flavor notes set huge on the home and product pages, because flavor is what the brand sells.
45. **Your existing copy** (mission, roasting, founders, testimonials) was kept and lightly edited for clarity.
46. **The footer social links pointed at Shopify's own accounts.** They now come from Settings and stay hidden until you add yours.

## Known limitations and next steps

- **First full build not yet run** (see Verification).
- **Product photos are entered as URLs.** An upload button (Cloudflare R2) would be a good next addition.
- **Campaigns send within one request.** That's fine for hundreds of subscribers; past about 2,000, move sending to a Cloudflare Queue.
- **No stock reservation during checkout.** Two people could buy the last bag at the same instant. Stock can then go negative and shows red in the admin.
- **Not built because the Shopify store wasn't using them:** gift cards, product reviews, blog, multi-currency, shipping labels.
- **Subscription changes in Settings** (discount, delivery fee) apply to new subscriptions only. Existing subscribers keep their price, which is the fair default.
- **Renewal orders copy the delivery address saved with the subscription.** If a subscriber changes their address in the Stripe portal, edit the address on the renewal order in the admin (it has an "edit" link under the address).
