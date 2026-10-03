"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { flash } from "@/lib/flash";
import { parseDollarsToCents } from "@/lib/money";
import { isSubscriptionDiscountType, type SubscriptionDiscountType } from "@/lib/pricing";

export async function slugify(s: string): Promise<string> {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function str(f: FormData, k: string): string | null {
  const v = String(f.get(k) ?? "").trim();
  return v || null;
}

/** Reads the per-product subscriber discount fields. Percent is stored as 0–90, dollar amounts as cents. */
function parseSubscriptionDiscount(formData: FormData, id: number | null): { subscriptionDiscountType: SubscriptionDiscountType; subscriptionDiscountValue: number | null } {
  const back = id ? `/admin/products/${id}` : "/admin/products/new";
  const rawType = formData.get("subscriptionDiscountType");
  const type: SubscriptionDiscountType = isSubscriptionDiscountType(rawType) ? rawType : "default";
  if (type === "default") return { subscriptionDiscountType: "default", subscriptionDiscountValue: null };
  const raw = String(formData.get("subscriptionDiscountValue") ?? "").trim().replace(/[%$\s]/g, "");
  if (type === "percent") {
    const pct = Number(raw);
    if (raw === "" || !Number.isFinite(pct) || pct < 0 || pct > 90) flash(back, "error", "Enter a subscriber discount between 0 and 90 percent.");
    return { subscriptionDiscountType: "percent", subscriptionDiscountValue: Math.round(pct) };
  }
  const cents = parseDollarsToCents(raw);
  if (cents === null || cents < 0) flash(back, "error", "Enter the subscriber discount as a dollar amount, like 3.00.");
  return { subscriptionDiscountType: "amount", subscriptionDiscountValue: cents };
}

export async function saveProduct(formData: FormData) {
  await requireOwner();
  const id = Number(formData.get("id")) || null;
  const title = str(formData, "title");
  if (!title) flash(id ? `/admin/products/${id}` : "/admin/products/new", "error", "Give the product a name.");
  const handle = (await slugify(str(formData, "handle") ?? title)) || `product-${Date.now()}`;
  const images = String(formData.get("images") ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => /^(https:\/\/|\/)/.test(s));
  const status = String(formData.get("status"));
  const kind = String(formData.get("kind"));
  const values = {
    title,
    handle,
    kind: (["beans", "cold_brew", "other"].includes(kind) ? kind : "beans") as "beans" | "cold_brew" | "other",
    status: (["active", "draft", "archived"].includes(status) ? status : "draft") as "active" | "draft" | "archived",
    origin: str(formData, "origin"),
    process: str(formData, "process"),
    flavorNotes: str(formData, "flavorNotes"),
    cuppingScore: str(formData, "cuppingScore"),
    descriptionHtml: String(formData.get("descriptionHtml") ?? ""),
    images,
    taxCode: str(formData, "taxCode"),
    subscriptionEnabled: formData.get("subscriptionEnabled") === "on",
    ...parseSubscriptionDiscount(formData, id),
    featured: formData.get("featured") === "on",
    sortOrder: Number(formData.get("sortOrder")) || 0,
    updatedAt: new Date(),
  };

  const clash = await db().query.products.findFirst({ where: eq(schema.products.handle, handle) });
  if (clash && clash.id !== id) flash(id ? `/admin/products/${id}` : "/admin/products/new", "error", `The web address "${handle}" is already used by ${clash.title}.`);

  let productId = id;
  if (id) {
    await db().update(schema.products).set(values).where(eq(schema.products.id, id));
  } else {
    const [row] = await db().insert(schema.products).values(values).returning({ id: schema.products.id });
    productId = row!.id;
  }
  if (values.featured) {
    // Only one product drives the home page hero.
    const all = await db().select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.featured, true));
    for (const p of all) if (p.id !== productId) await db().update(schema.products).set({ featured: false }).where(eq(schema.products.id, p.id));
  }
  revalidatePath("/", "layout");
  flash(`/admin/products/${productId}`, "ok", id ? "Product saved." : "Product created. Add its sizes and grinds below.");
}

export async function saveVariants(formData: FormData) {
  await requireOwner();
  const productId = Number(formData.get("productId"));
  const ids = formData.getAll("variantId").map(Number);
  for (const vid of ids) {
    const g = (k: string) => formData.get(`v_${vid}_${k}`);
    const price = parseDollarsToCents(g("price"));
    if (price === null || price < 0) flash(`/admin/products/${productId}`, "error", "Every option needs a price.");
    await db()
      .update(schema.variants)
      .set({
        size: String(g("size") ?? "").trim() || null,
        grind: String(g("grind") ?? "").trim() || null,
        title: [String(g("size") ?? "").trim(), String(g("grind") ?? "").trim()].filter(Boolean).join(" / ") || "Default",
        priceCents: price,
        unitCostCents: parseDollarsToCents(g("cost")),
        inventory: Math.trunc(Number(g("inventory")) || 0),
        trackInventory: g("track") === "on",
        active: g("active") === "on",
        sku: String(g("sku") ?? "").trim() || null,
        position: Math.trunc(Number(g("position")) || 0),
        updatedAt: new Date(),
      })
      .where(and(eq(schema.variants.id, vid), eq(schema.variants.productId, productId)));
  }
  revalidatePath("/", "layout");
  flash(`/admin/products/${productId}`, "ok", "Options saved.");
}

/** Adds one option, or one per grind when several grinds are listed (e.g. "Whole Bean, Coarse, Medium, Fine"). */
export async function addVariants(formData: FormData) {
  await requireOwner();
  const productId = Number(formData.get("productId"));
  const size = str(formData, "size");
  const grinds = String(formData.get("grinds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const price = parseDollarsToCents(formData.get("price"));
  if (price === null) flash(`/admin/products/${productId}`, "error", "Enter a price for the new option.");
  const cost = parseDollarsToCents(formData.get("cost"));
  const inventory = Math.trunc(Number(formData.get("inventory")) || 0);
  const track = formData.get("track") === "on";
  const [{ value: existing }] = await db().select({ value: count() }).from(schema.variants).where(eq(schema.variants.productId, productId));
  const list = grinds.length ? grinds : [null];
  await db()
    .insert(schema.variants)
    .values(
      list.map((grind, i) => ({
        productId,
        size,
        grind,
        title: [size, grind].filter(Boolean).join(" / ") || "Default",
        priceCents: price,
        unitCostCents: cost,
        inventory,
        trackInventory: track,
        position: existing + i,
      })),
    );
  revalidatePath("/", "layout");
  flash(`/admin/products/${productId}`, "ok", `Added ${list.length} option${list.length === 1 ? "" : "s"}.`);
}

export async function removeVariant(formData: FormData) {
  await requireOwner();
  const productId = Number(formData.get("productId"));
  const id = Number(formData.get("variantId"));
  const [{ value: sold }] = await db().select({ value: count() }).from(schema.orderItems).where(eq(schema.orderItems.variantId, id));
  if (sold > 0) {
    await db().update(schema.variants).set({ active: false }).where(eq(schema.variants.id, id));
    flash(`/admin/products/${productId}`, "ok", "This option has sales history, so it was hidden instead of deleted.");
  }
  await db().delete(schema.variants).where(eq(schema.variants.id, id));
  revalidatePath("/", "layout");
  flash(`/admin/products/${productId}`, "ok", "Option removed.");
}
