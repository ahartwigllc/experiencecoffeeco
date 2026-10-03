"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

export async function unsubscribe(formData: FormData) {
  const email = await verifyUnsubscribe(String(formData.get("e") ?? ""), String(formData.get("s") ?? ""));
  if (!email) redirect("/unsubscribe?result=invalid");
  await db()
    .update(schema.subscribers)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(schema.subscribers.email, email));
  await db().update(schema.customers).set({ acceptsMarketing: false }).where(eq(schema.customers.email, email));
  redirect("/unsubscribe?result=ok");
}
