import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type CustomerInput = {
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  stripeCustomerId?: string | null;
  address?: { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null } | null;
};

export function splitName(name?: string | null): { firstName: string | null; lastName: string | null } {
  if (!name) return { firstName: null, lastName: null };
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? null, lastName: parts.slice(1).join(" ") || null };
}

/**
 * Finds a customer by Stripe id or email and fills in any missing details;
 * creates one if none exists. Never overwrites data the owner already has.
 */
export async function upsertCustomer(input: CustomerInput): Promise<number | null> {
  const email = input.email?.trim().toLowerCase() || null;
  const names = input.firstName || input.lastName ? { firstName: input.firstName ?? null, lastName: input.lastName ?? null } : splitName(input.name);

  let existing =
    (input.stripeCustomerId &&
      (await db().query.customers.findFirst({ where: eq(schema.customers.stripeCustomerId, input.stripeCustomerId) }))) ||
    (email && (await db().query.customers.findFirst({ where: eq(schema.customers.email, email) }))) ||
    null;

  if (!existing && !email && !input.stripeCustomerId) return null;

  if (!existing) {
    const [row] = await db()
      .insert(schema.customers)
      .values({
        email,
        phone: input.phone ?? null,
        firstName: names.firstName,
        lastName: names.lastName,
        stripeCustomerId: input.stripeCustomerId ?? null,
        address1: input.address?.line1 ?? null,
        address2: input.address?.line2 ?? null,
        city: input.address?.city ?? null,
        state: input.address?.state ?? null,
        zip: input.address?.postal_code ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: schema.customers.id });
    if (row) return row.id;
    // Lost a race with a concurrent insert: re-read.
    existing =
      (email && (await db().query.customers.findFirst({ where: eq(schema.customers.email, email) }))) ||
      (input.stripeCustomerId &&
        (await db().query.customers.findFirst({ where: eq(schema.customers.stripeCustomerId, input.stripeCustomerId) }))) ||
      null;
    if (!existing) return null;
  }

  await db()
    .update(schema.customers)
    .set({
      email: existing.email ?? email,
      phone: existing.phone ?? input.phone ?? null,
      firstName: existing.firstName ?? names.firstName,
      lastName: existing.lastName ?? names.lastName,
      stripeCustomerId: existing.stripeCustomerId ?? input.stripeCustomerId ?? null,
      address1: existing.address1 ?? input.address?.line1 ?? null,
      address2: existing.address2 ?? input.address?.line2 ?? null,
      city: existing.city ?? input.address?.city ?? null,
      state: existing.state ?? input.address?.state ?? null,
      zip: existing.zip ?? input.address?.postal_code ?? null,
      updatedAt: sql`now()`,
    })
    .where(eq(schema.customers.id, existing.id));
  return existing.id;
}

export function customerName(c: { firstName: string | null; lastName: string | null; email: string | null; phone?: string | null }): string {
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return n || c.email || c.phone || "Guest";
}
