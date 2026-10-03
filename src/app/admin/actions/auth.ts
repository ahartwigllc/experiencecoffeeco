"use server";

import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import { createAdminSession, destroyAdminSession } from "@/lib/auth";
import { hashPassword, safeEqual, verifyPassword } from "@/lib/crypto";
import { normalizeEmail } from "@/lib/http";

export async function signIn(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/admin/login?error=Enter+your+email+and+password.");
  const [user] = await db().select().from(schema.staff).where(eq(schema.staff.email, email)).limit(1);
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, "pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAA"), false);
  if (!user || !ok || !user.active) redirect("/admin/login?error=That+email+and+password+don%27t+match.");
  await createAdminSession(user.id);
  redirect(user.role === "owner" ? "/admin" : "/admin/timeclock");
}

export async function signOut() {
  await destroyAdminSession();
  redirect("/admin/login");
}

/** First-run only: creates the owner account when no staff exist and SETUP_TOKEN matches. */
export async function setupOwner(formData: FormData) {
  const expected = process.env.SETUP_TOKEN;
  const token = String(formData.get("token") ?? "");
  if (!expected || !safeEqual(token, expected)) redirect("/admin/setup?error=The+setup+token+is+wrong+or+not+configured.");
  const [{ value: existing }] = await db().select({ value: count() }).from(schema.staff);
  if (existing > 0) redirect("/admin/login?error=Setup+is+already+done.+Sign+in+instead.");
  const email = normalizeEmail(formData.get("email"));
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !name || password.length < 12) redirect("/admin/setup?error=Use+a+valid+email,+your+name,+and+a+password+of+12%2B+characters.");
  const [row] = await db()
    .insert(schema.staff)
    .values({ email, name, role: "owner", passwordHash: await hashPassword(password) })
    .returning({ id: schema.staff.id });
  await createAdminSession(row!.id);
  redirect("/admin?ok=Welcome.+Your+owner+account+is+ready.");
}
