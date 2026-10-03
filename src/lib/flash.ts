import { redirect } from "next/navigation";

/** Redirect back to a page with a one-line success or error message in the query string. */
export function flash(path: string, kind: "ok" | "error", message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

export type FlashParams = { ok?: string; error?: string };
