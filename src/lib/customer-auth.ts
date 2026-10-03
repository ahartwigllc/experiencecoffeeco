import { cookies } from "next/headers";
import { createSignedToken, readSignedToken } from "./crypto";
import { sessionSecret } from "./env";

/** Customers sign in with emailed one-time links (no passwords to migrate or leak). */
export const CUSTOMER_COOKIE = "ec_customer";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function createCustomerSession(email: string): Promise<void> {
  const token = await createSignedToken({ email, typ: "customer" }, sessionSecret(), MAX_AGE);
  (await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getCustomerEmail(): Promise<string | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  const p = await readSignedToken<{ email: string; typ: string }>(token, sessionSecret());
  return p && p.typ === "customer" && typeof p.email === "string" ? p.email : null;
}

export async function destroyCustomerSession(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}
