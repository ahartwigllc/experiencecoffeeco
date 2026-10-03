import { hmacSign, hmacVerify, toBase64Url, fromBase64Url } from "./crypto";
import { sessionSecret, siteUrl } from "./env";

/** Signed, non-expiring unsubscribe links (they must keep working forever). */
export async function unsubscribeUrl(email: string): Promise<string> {
  const e = toBase64Url(new TextEncoder().encode(email));
  const s = await hmacSign(`unsub:${email}`, sessionSecret());
  return `${siteUrl()}/unsubscribe?e=${e}&s=${s}`;
}

export async function verifyUnsubscribe(e: string | null, s: string | null): Promise<string | null> {
  if (!e || !s) return null;
  try {
    const email = new TextDecoder().decode(fromBase64Url(e));
    return (await hmacVerify(`unsub:${email}`, s, sessionSecret())) ? email : null;
  } catch {
    return null;
  }
}

export async function oneClickUnsubscribeUrl(email: string): Promise<string> {
  return (await unsubscribeUrl(email)).replace("/unsubscribe?", "/api/unsubscribe?");
}
