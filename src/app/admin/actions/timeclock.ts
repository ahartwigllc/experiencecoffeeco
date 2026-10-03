"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { requireOwner, requireStaff } from "@/lib/auth";
import { parseLocalDateTime } from "@/lib/dates";
import { flash } from "@/lib/flash";

const PAGE = "/admin/timeclock";

export async function clockIn(formData: FormData) {
  const me = await requireStaff();
  const open = await db().query.timeEntries.findFirst({ where: and(eq(schema.timeEntries.staffId, me.id), isNull(schema.timeEntries.clockOut)) });
  if (open) flash(PAGE, "error", "You're already clocked in.");
  await db()
    .insert(schema.timeEntries)
    .values({ staffId: me.id, clockIn: new Date(), hourlyWageCents: me.hourlyWageCents, note: String(formData.get("note") ?? "").trim() || null });
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Clocked in. Have a good shift.");
}

export async function clockOut(formData: FormData) {
  const me = await requireStaff();
  const targetId = Number(formData.get("staffId")) || me.id;
  if (targetId !== me.id && me.role !== "owner") flash(PAGE, "error", "Only an owner can clock someone else out.");
  const open = await db().query.timeEntries.findFirst({ where: and(eq(schema.timeEntries.staffId, targetId), isNull(schema.timeEntries.clockOut)) });
  if (!open) flash(PAGE, "error", "Not clocked in.");
  const note = String(formData.get("note") ?? "").trim();
  await db()
    .update(schema.timeEntries)
    .set({ clockOut: new Date(), note: note ? [open.note, note].filter(Boolean).join(" / ") : open.note, editedById: targetId !== me.id ? me.id : null })
    .where(eq(schema.timeEntries.id, open.id));
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Clocked out.");
}

function readShift(formData: FormData) {
  const clockInAt = parseLocalDateTime(String(formData.get("clockIn") ?? ""));
  const outRaw = String(formData.get("clockOut") ?? "");
  const clockOutAt = outRaw ? parseLocalDateTime(outRaw) : null;
  if (!clockInAt) flash(PAGE, "error", "Enter a valid start time.");
  if (outRaw && !clockOutAt) flash(PAGE, "error", "Enter a valid end time.");
  if (clockOutAt && clockOutAt <= clockInAt) flash(PAGE, "error", "The end time has to be after the start time.");
  if (clockOutAt && clockOutAt.getTime() - clockInAt.getTime() > 24 * 3600_000) flash(PAGE, "error", "Shifts can't be longer than 24 hours. Split it into two entries.");
  return { clockInAt, clockOutAt };
}

export async function addEntry(formData: FormData) {
  const me = await requireOwner();
  const staffId = Number(formData.get("staffId"));
  const person = await db().query.staff.findFirst({ where: eq(schema.staff.id, staffId) });
  if (!person) flash(PAGE, "error", "Choose a team member.");
  const { clockInAt, clockOutAt } = readShift(formData);
  await db().insert(schema.timeEntries).values({
    staffId,
    clockIn: clockInAt,
    clockOut: clockOutAt,
    hourlyWageCents: person.hourlyWageCents,
    note: String(formData.get("note") ?? "").trim() || null,
    editedById: me.id,
  });
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Shift added.");
}

export async function updateEntry(formData: FormData) {
  const me = await requireOwner();
  const id = Number(formData.get("id"));
  const { clockInAt, clockOutAt } = readShift(formData);
  await db()
    .update(schema.timeEntries)
    .set({ clockIn: clockInAt, clockOut: clockOutAt, note: String(formData.get("note") ?? "").trim() || null, editedById: me.id })
    .where(eq(schema.timeEntries.id, id));
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Shift updated.");
}

export async function deleteEntry(formData: FormData) {
  await requireOwner();
  await db().delete(schema.timeEntries).where(eq(schema.timeEntries.id, Number(formData.get("id"))));
  revalidatePath(PAGE);
  flash(PAGE, "ok", "Shift deleted.");
}
