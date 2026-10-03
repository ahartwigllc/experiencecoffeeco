"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { flash } from "@/lib/flash";
import { normalizeEmail } from "@/lib/http";
import { parseDollarsToCents } from "@/lib/money";
import { isInterval, normalizeZip } from "@/lib/pricing";
import { getSettings, saveSettings } from "@/lib/settings";

/* ---------------------------------------------------------------- messages */

export async function toggleMessage(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id"));
  const m = await db().query.contactMessages.findFirst({ where: eq(schema.contactMessages.id, id) });
  if (m) await db().update(schema.contactMessages).set({ handled: !m.handled }).where(eq(schema.contactMessages.id, id));
  revalidatePath("/admin/messages");
}

/* ------------------------------------------------------------------- staff */

export async function addStaff(formData: FormData) {
  await requireOwner();
  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !name) flash("/admin/staff", "error", "Enter a name and a valid email.");
  if (password.length < 10) flash("/admin/staff", "error", "Temporary passwords need 10 or more characters.");
  const exists = await db().query.staff.findFirst({ where: eq(schema.staff.email, email) });
  if (exists) flash("/admin/staff", "error", "Someone already uses that email.");
  await db()
    .insert(schema.staff)
    .values({
      email,
      name,
      role: formData.get("role") === "owner" ? "owner" : "staff",
      hourlyWageCents: parseDollarsToCents(formData.get("wage")) ?? 0,
      passwordHash: await hashPassword(password),
    });
  revalidatePath("/admin/staff");
  flash("/admin/staff", "ok", `${name} added. Share the sign-in page (/admin/login) and their temporary password.`);
}

export async function updateStaff(formData: FormData) {
  const me = await requireOwner();
  const id = Number(formData.get("id"));
  const role = formData.get("role") === "owner" ? "owner" : "staff";
  const active = formData.get("active") === "on";
  if (id === me.id && (role !== "owner" || !active)) flash("/admin/staff", "error", "You can't remove your own owner access.");
  if (role !== "owner" || !active) {
    const [{ value: owners }] = await db()
      .select({ value: count() })
      .from(schema.staff)
      .where(and(eq(schema.staff.role, "owner"), eq(schema.staff.active, true), ne(schema.staff.id, id)));
    if (owners === 0) flash("/admin/staff", "error", "There has to be at least one active owner.");
  }
  const password = String(formData.get("password") ?? "");
  if (password && password.length < 10) flash("/admin/staff", "error", "New passwords need 10 or more characters.");
  await db()
    .update(schema.staff)
    .set({
      name: String(formData.get("name") ?? "").trim() || undefined,
      role,
      active,
      hourlyWageCents: parseDollarsToCents(formData.get("wage")) ?? 0,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    })
    .where(eq(schema.staff.id, id));
  revalidatePath("/admin/staff");
  flash("/admin/staff", "ok", password ? "Saved, and the password was changed." : "Saved.");
}

/* ---------------------------------------------------------------- settings */

export async function saveStoreSettings(formData: FormData) {
  await requireOwner();
  const current = await getSettings();
  const str = (k: string, fallback: string) => {
    const v = formData.get(k);
    return v === null ? fallback : String(v).trim();
  };
  const num = (k: string, fallback: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && formData.get(k) !== null && formData.get(k) !== "" ? v : fallback;
  };
  const cents = (k: string, fallback: number) => parseDollarsToCents(formData.get(k)) ?? fallback;
  const zips = String(formData.get("deliveryZips") ?? "")
    .split(/[\s,]+/)
    .map(normalizeZip)
    .filter((z) => /^\d{5}$/.test(z));
  const intervals = formData.getAll("subscriptionIntervals").map(String).filter(isInterval);
  const taxMode = formData.get("taxMode") === "stripe_tax" ? "stripe_tax" : "none";
  const cogsMethod = formData.get("cogsMethod") === "purchases" ? "purchases" : "unit_cost";
  const notify = normalizeEmail(formData.get("ownerNotifyEmail"));
  const support = normalizeEmail(formData.get("supportEmail"));

  if (!intervals.length) flash("/admin/settings", "error", "Keep at least one subscription schedule on.");
  if (!formData.get("pickupEnabled") && !formData.get("deliveryEnabled") && !formData.get("shippingEnabled"))
    flash("/admin/settings", "error", "Turn on at least one way for customers to get their order.");

  await saveSettings({
    businessName: str("businessName", current.businessName) || current.businessName,
    supportEmail: support ?? current.supportEmail,
    ownerNotifyEmail: notify ?? current.ownerNotifyEmail,
    phone: str("phone", current.phone),
    businessPostalAddress: str("businessPostalAddress", current.businessPostalAddress) || current.businessPostalAddress,
    announcement: str("announcement", current.announcement).slice(0, 160),
    instagramUrl: str("instagramUrl", current.instagramUrl),
    tiktokUrl: str("tiktokUrl", current.tiktokUrl),
    subscriptionDiscountPercent: Math.min(90, Math.max(0, Math.round(num("subscriptionDiscountPercent", current.subscriptionDiscountPercent)))),
    subscriptionIntervals: intervals,
    pickupEnabled: formData.get("pickupEnabled") === "on",
    pickupAddress: str("pickupAddress", current.pickupAddress),
    pickupInstructions: str("pickupInstructions", current.pickupInstructions),
    deliveryEnabled: formData.get("deliveryEnabled") === "on",
    deliveryFeeCents: cents("deliveryFee", current.deliveryFeeCents),
    deliveryMinimumCents: cents("deliveryMinimum", current.deliveryMinimumCents),
    deliveryZips: zips.length ? [...new Set(zips)] : current.deliveryZips,
    deliveryNote: str("deliveryNote", current.deliveryNote),
    shippingEnabled: formData.get("shippingEnabled") === "on",
    shippingFlatCents: cents("shippingFlat", current.shippingFlatCents),
    freeShippingOverCents: cents("freeShippingOver", current.freeShippingOverCents),
    taxMode,
    incomeTaxReservePercent: Math.min(60, Math.max(0, num("incomeTaxReservePercent", current.incomeTaxReservePercent))),
    cogsMethod,
    lowInventoryThreshold: Math.max(0, Math.round(num("lowInventoryThreshold", current.lowInventoryThreshold))),
  });
  revalidatePath("/", "layout");
  flash("/admin/settings", "ok", "Settings saved.");
}
