-- Loans to the business (e.g. owner transfers from Ally) and repayments. Kept off the P&L.
CREATE TABLE IF NOT EXISTS "loan_entries" (
  "id" serial PRIMARY KEY,
  "entry_on" date NOT NULL,
  "lender" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('draw', 'payment')),
  "amount_cents" integer NOT NULL CHECK ("amount_cents" > 0),
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "loan_entries_on_idx" ON "loan_entries" ("entry_on");
