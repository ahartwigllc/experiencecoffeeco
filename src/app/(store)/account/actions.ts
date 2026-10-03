"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { sha256Hex } from "@/lib/crypto";
import { createCustomerSession, destroyCustomerSession } from "@/lib/customer-auth";

/** Sign-in happens on a button press (POST), so email link scanners can't burn the token. */
export async function verifyMagicLink(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/account?error=link");
  const hash = await sha256Hex(token);
  const [row] = await db()
    .update(schema.magicLinks)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.magicLinks.tokenHash, hash), isNull(schema.magicLinks.usedAt), gt(schema.magicLinks.expiresAt, new Date())))
    .returning({ email: schema.magicLinks.email });
  if (!row) redirect("/account?error=link");
  await createCustomerSession(row.email);
  redirect("/account");
}

export async function signOutCustomer() {
  await destroyCustomerSession();
  redirect("/account");
}
