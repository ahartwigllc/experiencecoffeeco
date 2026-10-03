const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatCents(cents: number | null | undefined, fallback = "—"): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return fallback;
  return usd.format(cents / 100);
}

/** Parses "12.5", "$12.50", "1,200" into cents. Returns null for blank/invalid input. */
export function parseDollarsToCents(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export function percent(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}
