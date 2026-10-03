import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db/client";
import type { Staff } from "@/db/schema";
import { createSignedToken, readSignedToken } from "./crypto";
import { sessionSecret } from "./env";

export const ADMIN_COOKIE = "ec_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

export async function createAdminSession(staffId: number): Promise<void> {
  const token = await createSignedToken({ sid: staffId, typ: "admin" }, sessionSecret(), MAX_AGE);
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroyAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getCurrentStaff(): Promise<Staff | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await readSignedToken<{ sid: number; typ: string }>(token, sessionSecret());
  if (!payload || payload.typ !== "admin" || typeof payload.sid !== "number") return null;
  const [row] = await db()
    .select()
    .from(schema.staff)
    .where(and(eq(schema.staff.id, payload.sid), eq(schema.staff.active, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Use at the top of every admin page and server action.
 * Staff (non-owners) can only use the time clock.
 */
export async function requireStaff(): Promise<Staff> {
  const s = await getCurrentStaff();
  if (!s) redirect("/admin/login");
  return s;
}

export async function requireOwner(): Promise<Staff> {
  const s = await requireStaff();
  if (s.role !== "owner") redirect("/admin/timeclock");
  return s;
}
