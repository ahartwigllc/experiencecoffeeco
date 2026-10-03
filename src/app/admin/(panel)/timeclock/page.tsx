import { and, asc, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { ClockTimer } from "@/components/admin/ClockTimer";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireStaff } from "@/lib/auth";
import { formatDate, formatTime, hoursBetween, isRangeKey, RANGE_LABELS, rangeBounds, toLocalInputValue, type RangeKey } from "@/lib/dates";
import { getLaborByStaff } from "@/lib/finance";
import { formatCents } from "@/lib/money";
import { addEntry, clockIn, clockOut, deleteEntry, updateEntry } from "../../actions/timeclock";

const RANGES: RangeKey[] = ["week", "month", "last_month", "ytd"];

export default async function TimeClockPage({ searchParams }: { searchParams: Promise<{ range?: string; ok?: string; error?: string }> }) {
  const me = await requireStaff();
  const sp = await searchParams;
  const range: RangeKey = isRangeKey(sp.range) && RANGES.includes(sp.range) ? sp.range : "week";
  const { start, end } = rangeBounds(range);
  const week = rangeBounds("week");

  const [open, mine, staffList, allEntries, labor, openAll] = await Promise.all([
    db().query.timeEntries.findFirst({ where: and(eq(schema.timeEntries.staffId, me.id), isNull(schema.timeEntries.clockOut)) }),
    db().query.timeEntries.findMany({
      where: and(eq(schema.timeEntries.staffId, me.id), gte(schema.timeEntries.clockIn, week.start), lt(schema.timeEntries.clockIn, week.end)),
      orderBy: [desc(schema.timeEntries.clockIn)],
    }),
    me.role === "owner" ? db().select().from(schema.staff).where(eq(schema.staff.active, true)).orderBy(asc(schema.staff.name)) : Promise.resolve([]),
    me.role === "owner"
      ? db().query.timeEntries.findMany({
          where: and(gte(schema.timeEntries.clockIn, start), lt(schema.timeEntries.clockIn, end)),
          with: { staff: true },
          orderBy: [desc(schema.timeEntries.clockIn)],
          limit: 300,
        })
      : Promise.resolve([]),
    me.role === "owner" ? getLaborByStaff(start, end) : Promise.resolve([]),
    me.role === "owner" ? db().query.timeEntries.findMany({ where: isNull(schema.timeEntries.clockOut), with: { staff: true } }) : Promise.resolve([]),
  ]);

  const myHours = mine.reduce((a, t) => a + hoursBetween(t.clockIn, t.clockOut ?? new Date()), 0);

  return (
    <>
      <div className="admin-head">
        <h1>Time clock</h1>
      </div>
      <Flash ok={sp.ok} error={sp.error} />

      <div className="grid-2">
        <div className="card">
          <h2>{open ? `On the clock since ${formatTime(open.clockIn)}` : `Hi ${me.name.split(" ")[0]}, you're clocked out`}</h2>
          {open ? <ClockTimer since={open.clockIn.toISOString()} /> : <div className="clock-face muted">0:00:00</div>}
          <form action={open ? clockOut : clockIn} className="admin-form">
            <input name="note" placeholder={open ? "What did you work on? (optional)" : "Note (optional)"} />
            <div>
              <button className={`btn ${open ? "" : "btn-cherry"}`} type="submit">
                {open ? "Clock out" : "Clock in"}
              </button>
            </div>
          </form>
        </div>
        <div className="card">
          <h2>Your week</h2>
          <p>
            <strong>{myHours.toFixed(2)} hours</strong>
            {me.hourlyWageCents ? <>, about {formatCents(Math.round(myHours * me.hourlyWageCents))} before taxes</> : null}
          </p>
          <table className="data">
            <tbody>
              {mine.map((t) => (
                <tr key={t.id}>
                  <td>{formatDate(t.clockIn, { weekday: "short", month: "short", day: "numeric" })}</td>
                  <td>
                    {formatTime(t.clockIn)} to {t.clockOut ? formatTime(t.clockOut) : "now"}
                  </td>
                  <td className="num">{hoursBetween(t.clockIn, t.clockOut ?? new Date()).toFixed(2)} h</td>
                </tr>
              ))}
              {mine.length === 0 && (
                <tr>
                  <td className="muted">No shifts yet this week.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {me.role === "owner" && (
        <>
          <div className="admin-head" style={{ marginTop: "1.5rem" }}>
            <h2 style={{ margin: 0 }}>Team hours</h2>
            <div className="toolbar">
              {RANGES.map((r) => (
                <a key={r} className={`btn btn-small ${r === range ? "" : "btn-ghost"}`} href={`?range=${r}`}>
                  {RANGE_LABELS[r]}
                </a>
              ))}
              <a className="btn btn-small btn-ghost" href={`/admin/timeclock/export?range=${range}`}>
                Export CSV
              </a>
            </div>
          </div>

          {openAll.length > 0 && (
            <div className="card">
              <h3>Clocked in now</h3>
              {openAll.map((t) => (
                <form key={t.id} action={clockOut} className="toolbar" style={{ marginBottom: 4 }}>
                  <input type="hidden" name="staffId" value={t.staffId} />
                  <span>
                    {t.staff.name} since {formatDate(t.clockIn, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                  </span>
                  {t.staffId !== me.id && (
                    <ConfirmButton message={`Clock ${t.staff.name} out now?`}>Clock out</ConfirmButton>
                  )}
                </form>
              ))}
            </div>
          )}

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Person</th>
                  <th className="num">Shifts</th>
                  <th className="num">Hours</th>
                  <th className="num">Labor cost</th>
                </tr>
              </thead>
              <tbody>
                {labor.map((l) => (
                  <tr key={l.staffId}>
                    <td>{l.name}</td>
                    <td className="num">{l.shifts}</td>
                    <td className="num">{l.hours.toFixed(2)}</td>
                    <td className="num">{formatCents(l.laborCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{labor.reduce((a, l) => a + l.shifts, 0)}</td>
                  <td className="num">{labor.reduce((a, l) => a + l.hours, 0).toFixed(2)}</td>
                  <td className="num">{formatCents(labor.reduce((a, l) => a + l.laborCents, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="small muted">
            Owners with a $0 wage still count toward hours, so profit per hour reflects all the time the business takes. Set wages in Team.
          </p>

          <h2>Shifts</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="num">Hours</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allEntries.map((t) => (
                  <tr key={t.id}>
                    <td>{t.staff.name}</td>
                    <td colSpan={4}>
                      <form action={updateEntry} className="toolbar">
                        <input type="hidden" name="id" value={t.id} />
                        <input type="datetime-local" name="clockIn" defaultValue={toLocalInputValue(t.clockIn)} aria-label="Start" style={{ width: 200 }} />
                        <input type="datetime-local" name="clockOut" defaultValue={toLocalInputValue(t.clockOut)} aria-label="End" style={{ width: 200 }} />
                        <span className="num" style={{ minWidth: 60 }}>
                          {t.clockOut ? hoursBetween(t.clockIn, t.clockOut).toFixed(2) : "open"}
                        </span>
                        <input name="note" defaultValue={t.note ?? ""} aria-label="Note" style={{ width: 180 }} />
                        <button className="btn btn-small btn-ghost" type="submit">
                          Save
                        </button>
                      </form>
                    </td>
                    <td>
                      <form action={deleteEntry}>
                        <input type="hidden" name="id" value={t.id} />
                        <ConfirmButton message="Delete this shift?">Delete</ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {allEntries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted">
                      No shifts in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2>Add a missed shift</h2>
          <form action={addEntry} className="card admin-form">
            <div className="row">
              <div className="field">
                <label htmlFor="staffId">Person</label>
                <select id="staffId" name="staffId" required>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="clockIn">Start</label>
                <input id="clockIn" name="clockIn" type="datetime-local" required />
              </div>
              <div className="field">
                <label htmlFor="clockOut">End</label>
                <input id="clockOut" name="clockOut" type="datetime-local" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="note">Note</label>
              <input id="note" name="note" placeholder="Roasting, packing, deliveries…" />
            </div>
            <div>
              <button className="btn btn-small" type="submit">
                Add shift
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
