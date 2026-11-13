import { asc } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type LenderSummary = {
  lender: string;
  borrowedCents: number;
  repaidCents: number;
  owedCents: number;
  paidThisYearCents: number;
  lastPayment: { on: string; amountCents: number } | null;
};

/** Balance per lender from the loans ledger, largest balance first. */
export async function getLoanSummary(year = new Date().getFullYear()): Promise<LenderSummary[]> {
  const rows = await db().select().from(schema.loanEntries).orderBy(asc(schema.loanEntries.entryOn), asc(schema.loanEntries.id));
  const by = new Map<string, LenderSummary>();
  for (const e of rows) {
    const s =
      by.get(e.lender) ?? { lender: e.lender, borrowedCents: 0, repaidCents: 0, owedCents: 0, paidThisYearCents: 0, lastPayment: null };
    if (e.kind === "draw") s.borrowedCents += e.amountCents;
    else {
      s.repaidCents += e.amountCents;
      if (e.entryOn.startsWith(String(year))) s.paidThisYearCents += e.amountCents;
      s.lastPayment = { on: e.entryOn, amountCents: e.amountCents };
    }
    s.owedCents = s.borrowedCents - s.repaidCents;
    by.set(e.lender, s);
  }
  return [...by.values()].sort((a, b) => b.owedCents - a.owedCents);
}

export const paidPercent = (s: Pick<LenderSummary, "borrowedCents" | "repaidCents">) =>
  s.borrowedCents > 0 ? Math.min(100, Math.round((s.repaidCents / s.borrowedCents) * 100)) : 100;
