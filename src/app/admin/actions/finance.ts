"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { flash } from "@/lib/flash";
import { parseDollarsToCents } from "@/lib/money";
import { reconcileMissingFees } from "@/lib/stripe-sync";

const CATEGORIES = ["green_coffee", "packaging", "ingredients", "equipment", "software", "marketing", "delivery", "rent", "fees", "other"] as const;

export async function fetchMissingFees() {
  await requireOwner();
  const r = await reconcileMissingFees(100);
  revalidatePath("/admin/finance");
  flash("/admin/finance", "ok", `Checked ${r.checked} orders, filled in ${r.updated} fees.`);
}

export async function addExpense(formData: FormData) {
  const me = await requireOwner();
  const spentOn = String(formData.get("spentOn") ?? "");
  const amount = parseDollarsToCents(formData.get("amount"));
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) flash("/admin/expenses", "error", "Pick the date you paid.");
  if (!amount || amount <= 0) flash("/admin/expenses", "error", "Enter the amount.");
  if (!description) flash("/admin/expenses", "error", "Describe what it was for.");
  await db()
    .insert(schema.expenses)
    .values({
      spentOn,
      amountCents: amount,
      description,
      vendor: String(formData.get("vendor") ?? "").trim() || null,
      category: (CATEGORIES as readonly string[]).includes(category) ? (category as (typeof CATEGORIES)[number]) : "other",
      createdById: me.id,
    });
  revalidatePath("/admin/expenses");
  flash("/admin/expenses", "ok", "Expense added.");
}

export async function deleteExpense(formData: FormData) {
  await requireOwner();
  await db().delete(schema.expenses).where(eq(schema.expenses.id, Number(formData.get("id"))));
  revalidatePath("/admin/expenses");
  flash("/admin/expenses", "ok", "Expense deleted.");
}
