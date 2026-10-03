"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { sha256Hex } from "@/lib/crypto";

export async function confirmSubscription(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/newsletter/confirm?result=invalid");
  const hash = await sha256Hex(token);
  const [row] = await db()
    .update(schema.subscribers)
    .set({ status: "subscribed", confirmedAt: new Date(), confirmTokenHash: null, unsubscribedAt: null })
    .where(eq(schema.subscribers.confirmTokenHash, hash))
    .returning({ email: schema.subscribers.email });
  if (!row) redirect("/newsletter/confirm?result=invalid");
  await db()
    .update(schema.customers)
    .set({ acceptsMarketing: true, updatedAt: sql`now()` })
    .where(eq(schema.customers.email, row.email));
  redirect("/newsletter/confirm?result=ok");
}
