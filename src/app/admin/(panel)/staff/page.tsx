import { asc } from "drizzle-orm";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { centsToInput } from "@/lib/money";
import { addStaff, updateStaff } from "../../actions/system";

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireOwner();
  const sp = await searchParams;
  const team = await db().select().from(schema.staff).orderBy(asc(schema.staff.name));
  return (
    <>
      <div className="admin-head">
        <h1>Team</h1>
      </div>
      <Flash {...sp} />
      <p className="muted small">
        Owners see everything. Staff can only use the time clock. Hourly wage drives labor cost on the profit page; leave owners at $0 if
        you don't pay yourselves hourly. Their hours still count toward profit per hour.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Hourly wage</th>
              <th>Active</th>
              <th>New password</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {team.map((s) => (
              <tr key={s.id}>
                <td colSpan={7}>
                  <form action={updateStaff} className="toolbar">
                    <input type="hidden" name="id" value={s.id} />
                    <input name="name" defaultValue={s.name} aria-label="Name" style={{ width: 160 }} />
                    <span className="small" style={{ width: 200 }}>{s.email}{s.id === me.id ? " (you)" : ""}</span>
                    <select name="role" defaultValue={s.role} aria-label="Role" style={{ width: 110 }}>
                      <option value="owner">Owner</option>
                      <option value="staff">Staff</option>
                    </select>
                    <input name="wage" defaultValue={centsToInput(s.hourlyWageCents)} inputMode="decimal" aria-label="Hourly wage" style={{ width: 90 }} />
                    <label className="check small">
                      <input type="checkbox" name="active" defaultChecked={s.active} /> Active
                    </label>
                    <input name="password" type="password" placeholder="leave blank" autoComplete="new-password" aria-label="New password" style={{ width: 150 }} />
                    <button className="btn btn-small btn-ghost" type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Add someone</h2>
      <form action={addStaff} className="card admin-form">
        <div className="row">
          <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required /></div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="staff">
              <option value="staff">Staff (time clock only)</option>
              <option value="owner">Owner (everything)</option>
            </select>
          </div>
          <div className="field"><label htmlFor="wage">Hourly wage ($)</label><input id="wage" name="wage" inputMode="decimal" placeholder="0.00" /></div>
          <div className="field"><label htmlFor="password">Temporary password</label><input id="password" name="password" type="text" minLength={10} required /></div>
        </div>
        <div><button className="btn btn-small" type="submit">Add to team</button></div>
      </form>
    </>
  );
}
