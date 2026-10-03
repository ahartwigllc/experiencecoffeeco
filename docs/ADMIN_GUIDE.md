# Admin guide

Sign in at **experiencecoffee.co/admin**. Owners see everything; staff see only the time clock.

## First week

1. **Products > each coffee**: fill in **Unit cost** for every size and grind: green coffee for that bag (allow for roast loss, typically 15–20%), plus bag, valve, and label. The Margin column fills in as you type and save. Until this is done, profit is overstated and the dashboard keeps reminding you.
2. **Team**: add G as an owner. Add anyone who helps roast or deliver as staff, with their hourly wage. Leave your own wage at $0 if you don't pay yourselves hourly.
3. **Settings**: check pickup and delivery details, the delivery ZIP list, your Instagram link, and the email footer address.
4. **Expenses**: add this month's green coffee, packaging, and software bills.

## Every day

- **Dashboard** shows today's sales, orders to prepare, who's clocked in, low stock, and new messages.
- **Clock in** when you start roasting, packing, or delivering, and clock out when done (Time clock). This is what makes "profit per hour" real.
- **Orders > To prepare**:
  - Open an order and press **Ready for pickup** or **Out for delivery**. With "Email customer" ticked, they get a note.
  - Press **Mark fulfilled** once it's in their hands.
  - To close out several at once, tick them in the list and use **Mark selected fulfilled**.
  - Orders flagged **needs review** have a delivery address outside your area. Contact the customer, then clear the flag.
- **Cash, Venmo, or market sales**: Orders > **Record an order**, so revenue and stock stay right.

## Subscriptions

- Renewals become new orders automatically and show a "renewal" badge.
- Customers manage their own subscriptions from **Account > Manage subscriptions and payment**. You can also **Pause**, **Resume**, or **Cancel** from Admin > Subscriptions.
- **Past due** means a card failed. Stripe retries automatically and emails the customer.
- **Moving Shopify subscribers**: use the list at the bottom of Subscriptions. Press **Send invite**, then cancel their Shopify subscription once they've restarted (they drop off the list when they do).

## Refunds

Open the order and enter the amount (it defaults to the full remaining amount). Tick "Put the items back in stock" if the coffee came back. Card payments refund through Stripe automatically. Cash and Venmo refunds are recorded here, and you pay them back yourself.

## Coupons

Coupons > Create. Choose percent or dollars off, then any limits: first order only, minimum order, total uses, end date. For subscriptions, "First payment only" is usually right. Customers type the code on the payment page. Turn a code off any time. "Given away" shows what each code has cost you.

## Month end (10 minutes)

1. **Profit and taxes > Last month**:
   - Revenue, fees, cost of goods, labor, expenses, and net profit.
   - Profit per hour.
   - Which coffees make money.
2. If it says some items have no unit cost, fix them on Products and the numbers update instantly.
3. If it says card fees are missing, press **Fetch fees now**.
4. **Export CSV** for your accountant, along with Orders and Time clock exports.
5. Move the "Set aside for income tax" amount into a separate savings account. Estimated tax payments are due around April 15, June 15, September 15, and January 15.

## Email marketing

1. Email marketing > **New email**. Write it in plain text:
   - Use a blank line between paragraphs.
   - `# Heading` makes a heading, `- item` makes a bullet, and `**bold**` makes bold.
   - `[text](https://link)` makes a link.
   - `{{button: Shop now | https://experiencecoffee.co/shop}}` makes a button.
2. **Save draft**, check the preview, then **Send test** to yourself and open it on your phone.
3. Type SEND and press **Send now**. Every email automatically includes your address and an unsubscribe link.
4. To add people from a sign-up sheet, paste their emails under **Add people**. Tick the permission box only if they actually said yes; otherwise they get a confirmation email first.

Good rhythm: one email when a new lot lands, one when a small lot is nearly gone. Twice a month at most.

## When something looks wrong

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| A paid order didn't appear | Stripe webhook isn't reaching the site | Stripe > Developers > Webhooks > your endpoint > check failed events, then "Resend" |
| Emails aren't arriving | Resend key or domain DNS | Settings shows "Email: not connected"; check the Resend dashboard for the domain status |
| Profit looks too high | Unit costs missing | Products, fill in costs |
| Can't sign in | Wrong password or the account is deactivated | Another owner resets it in Team, or run `npm run admin:create` |
| Checkout says "isn't set up yet" | Stripe key missing | Add `STRIPE_SECRET_KEY` in Cloudflare secrets |
