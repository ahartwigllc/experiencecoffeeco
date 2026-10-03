import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCustomerEmail } from "@/lib/customer-auth";
import { siteUrl } from "@/lib/env";
import { isSameOrigin } from "@/lib/http";
import { stripe } from "@/lib/stripe";

/** Sends a signed-in customer to Stripe's hosted portal to manage subscriptions and cards. */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const email = await getCustomerEmail();
  if (!email) return Response.redirect(`${siteUrl()}/account`, 303);
  const c = await db().query.customers.findFirst({ where: eq(schema.customers.email, email) });
  if (!c?.stripeCustomerId) return Response.redirect(`${siteUrl()}/account?portal=none`, 303);
  const session = await stripe().billingPortal.sessions.create({ customer: c.stripeCustomerId, return_url: `${siteUrl()}/account` });
  return Response.redirect(session.url, 303);
}
