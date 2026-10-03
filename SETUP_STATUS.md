# Setup status (3 Oct 2026)

## Done
- **Neon**: project "ExperienceCoffee" (AWS US East 2). All 18 tables, enums, foreign keys and indexes created
  (same SQL Drizzle would generate; saved in `migration/sql/0000_init.sql`, so `npm run db:push` should report no changes).
- **Catalog seeded**: 5 products, 29 options, from `products.snapshot.json`. Peru lot is featured; Guatemalan is archived.
- **Resend**: domain `experiencecoffee.co` added (us-east-1). Waiting on DNS records (below).
- **Unit tests**: 24/24 pass.
- **Stripe**: checked. Connected account "Experience Coffee", no webhooks yet (needs the deployed URL first).

## Not done yet
- `npm install` / `next build`: package downloads were blocked in the build sandbox. Run them on your machine (below).

## Your next steps
1. Unzip into `C:\Users\EarlGrey\Documents\GitHub\experiencecoffeeco`.
2. Save the supplied `env.local.txt` there as `.env.local` (and a copy as `.dev.vars`). Add your Stripe **test** key and Resend API key.
3. In that folder:
   ```
   npm install
   npm test
   npm run build          # first full compile — paste any errors to Claude
   npm run db:push        # should say "No changes"
   npm run dev            # http://localhost:3000 and /admin/setup
   ```
4. Commit and push (section 1 of docs/DEPLOYMENT.md), then continue from section 5 (Cloudflare DNS).

## Resend DNS records (add in Cloudflare DNS, section 5)
| Type | Name | Value | Priority |
| --- | --- | --- | --- |
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDGTMTRoyQR7DteLrmgDiOJwzFi+2ZVqyx98MdRkyf7MAejWBt8ny6rL6QhDTTKUQuiSmI9Sz+IYk2ODw1QDf59/eHFjGS3avPWxj3sX9SgcwUqRY3UwIaSdE5bCE3zNFkdvc/QfCXnMa5neYJN4dcTD3ICQTpUaudEEoR6ZovLxwIDAQAB` | |
| MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
| CNAME | `rsend` | `send.forge.rmta.net` | |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:ahartwigllc@gmail.com` | |
