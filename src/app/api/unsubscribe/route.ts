import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

/** RFC 8058 one-click unsubscribe target (used by Gmail/Apple Mail "Unsubscribe" buttons). */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = await verifyUnsubscribe(url.searchParams.get("e"), url.searchParams.get("s"));
  if (!email) return new Response("Invalid link", { status: 400 });
  await db()
    .update(schema.subscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(schema.subscribers.email, email));
  await db().update(schema.customers).set({ acceptsMarketing: false }).where(eq(schema.customers.email, email));
  return new Response("Unsubscribed", { status: 200 });
}
