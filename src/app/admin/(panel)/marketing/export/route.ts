import { asc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCurrentStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { localDateString } from "@/lib/dates";

export async function GET() {
  const me = await getCurrentStaff();
  if (!me || me.role !== "owner") return new Response("Forbidden", { status: 403 });
  const rows = await db().select().from(schema.subscribers).orderBy(asc(schema.subscribers.createdAt));
  return csvResponse(
    `subscribers-${localDateString()}.csv`,
    toCsv(["email", "status", "source", "created_at", "confirmed_at", "unsubscribed_at"], rows.map((r) => [r.email, r.status, r.source, r.createdAt, r.confirmedAt, r.unsubscribedAt])),
  );
}
