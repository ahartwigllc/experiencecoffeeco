import { and, asc, gte, lt } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getCurrentStaff } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { formatDateTime, hoursBetween, isRangeKey, localDateString, rangeBounds } from "@/lib/dates";

export async function GET(req: Request) {
  const me = await getCurrentStaff();
  if (!me || me.role !== "owner") return new Response("Forbidden", { status: 403 });
  const r = new URL(req.url).searchParams.get("range");
  const { start, end } = rangeBounds(isRangeKey(r) ? r : "week");
  const entries = await db().query.timeEntries.findMany({
    where: and(gte(schema.timeEntries.clockIn, start), lt(schema.timeEntries.clockIn, end)),
    with: { staff: true },
    orderBy: [asc(schema.timeEntries.clockIn)],
  });
  const body = toCsv(
    ["person", "email", "clock_in", "clock_out", "hours", "hourly_wage", "pay", "note"],
    entries.map((t) => {
      const h = t.clockOut ? hoursBetween(t.clockIn, t.clockOut) : 0;
      return [
        t.staff.name,
        t.staff.email,
        formatDateTime(t.clockIn),
        t.clockOut ? formatDateTime(t.clockOut) : "still clocked in",
        h.toFixed(2),
        (t.hourlyWageCents / 100).toFixed(2),
        ((h * t.hourlyWageCents) / 100).toFixed(2),
        t.note,
      ];
    }),
  );
  return csvResponse(`timesheet-${localDateString(start)}-to-${localDateString(new Date(end.getTime() - 1))}.csv`, body);
}
