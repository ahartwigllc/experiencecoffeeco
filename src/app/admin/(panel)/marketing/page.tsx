import Link from "next/link";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { isEmailConfigured } from "@/lib/email";
import { addSubscribers, createCampaign, setSubscriberStatus } from "../../actions/marketing";

export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ok?: string; error?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const where: SQL[] = [];
  if (sp.q) where.push(ilike(schema.subscribers.email, `%${sp.q.trim()}%`));
  if (sp.status && ["pending", "subscribed", "unsubscribed", "bounced"].includes(sp.status)) where.push(eq(schema.subscribers.status, sp.status as "subscribed"));
  const [campaigns, counts, subs] = await Promise.all([
    db().select().from(schema.campaigns).orderBy(desc(schema.campaigns.createdAt)).limit(50),
    db()
      .select({ status: schema.subscribers.status, n: sql<number>`count(*)::int` })
      .from(schema.subscribers)
      .groupBy(schema.subscribers.status),
    db()
      .select()
      .from(schema.subscribers)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(schema.subscribers.createdAt))
      .limit(300),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?.n ?? 0;

  return (
    <>
      <div className="admin-head">
        <h1>Email marketing</h1>
        <a className="btn btn-small btn-ghost" href="/admin/marketing/export">
          Export subscribers
        </a>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      {!isEmailConfigured() && <div className="flash error">Email isn't connected yet. Add RESEND_API_KEY to send anything.</div>}

      <div className="stats">
        <div className="stat"><div className="stat-label">Subscribed</div><div className="stat-value">{count("subscribed")}</div></div>
        <div className="stat"><div className="stat-label">Waiting to confirm</div><div className="stat-value">{count("pending")}</div></div>
        <div className="stat"><div className="stat-label">Unsubscribed</div><div className="stat-value">{count("unsubscribed")}</div></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Emails</h2>
          <form action={createCampaign} className="toolbar" style={{ marginBottom: "1rem" }}>
            <input name="subject" placeholder="Subject, e.g. New Peru lot just landed" required />
            <button className="btn btn-small" type="submit">New email</button>
          </form>
          <table className="data">
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/marketing/${c.id}`}>{c.subject}</Link></td>
                  <td><span className={`badge ${c.status === "sent" ? "green" : "amber"}`}>{c.status}</span></td>
                  <td className="small">{c.sentAt ? `${formatDate(c.sentAt)}, ${c.recipientCount} people` : formatDate(c.updatedAt)}</td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td className="muted">No emails yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Add people</h2>
          <form action={addSubscribers} className="admin-form">
            <textarea name="emails" placeholder="One or more emails, separated by commas or new lines" />
            <label className="check">
              <input type="checkbox" name="permission" /> They told me yes in person or on a sign-up sheet (skip the confirmation email)
            </label>
            <p className="small muted">Without the box checked, each person gets a confirmation email and joins when they click it. People who unsubscribed are never re-added.</p>
            <div><button className="btn btn-small" type="submit">Add</button></div>
          </form>
        </div>
      </div>

      <h2>Subscribers</h2>
      <form className="toolbar" style={{ marginBottom: "0.75rem" }}>
        <input type="search" name="q" defaultValue={sp.q} placeholder="Search email" style={{ maxWidth: 260 }} />
        <select name="status" defaultValue={sp.status ?? ""} style={{ maxWidth: 180 }}>
          <option value="">Everyone</option>
          <option value="subscribed">Subscribed</option>
          <option value="pending">Waiting to confirm</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
        <button className="btn btn-small" type="submit">Filter</button>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Email</th><th>Status</th><th>Source</th><th>Joined</th><th /></tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td><span className={`badge ${s.status === "subscribed" ? "green" : s.status === "pending" ? "amber" : ""}`}>{s.status}</span></td>
                <td className="small">{s.source}</td>
                <td>{formatDate(s.confirmedAt ?? s.createdAt)}</td>
                <td>
                  {s.status === "subscribed" && (
                    <form action={setSubscriberStatus}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="status" value="unsubscribed" />
                      <ConfirmButton message={`Unsubscribe ${s.email}?`}>Unsubscribe</ConfirmButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
