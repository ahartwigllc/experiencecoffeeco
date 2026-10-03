"use server";

import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { flash } from "@/lib/flash";
import { normalizeEmail } from "@/lib/http";

export async function saveCustomer(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const v = (k: string) => String(formData.get(k) ?? "").trim() || null;
  const email = formData.get("email") ? normalizeEmail(formData.get("email")) : null;
  if (formData.get("email") && !email) flash(`/admin/customers/${id}`, "error", "That email address isn't valid.");
  const accepts = formData.get("acceptsMarketing") === "on";
  try {
    await db()
      .update(schema.customers)
      .set({
        firstName: v("firstName"),
        lastName: v("lastName"),
        email,
        phone: v("phone"),
        address1: v("address1"),
        address2: v("address2"),
        city: v("city"),
        state: v("state"),
        zip: v("zip"),
        note: v("note"),
        acceptsMarketing: accepts,
        updatedAt: new Date(),
      })
      .where(eq(schema.customers.id, id));
  } catch {
    flash(`/admin/customers/${id}`, "error", "Another customer already uses that email.");
  }
  if (email) {
    const sub = await db().query.subscribers.findFirst({ where: eq(schema.subscribers.email, email) });
    if (!accepts && sub?.status === "subscribed")
      await db().update(schema.subscribers).set({ status: "unsubscribed", unsubscribedAt: new Date() }).where(eq(schema.subscribers.id, sub.id));
  }
  flash(`/admin/customers/${id}`, "ok", "Customer saved.");
}
