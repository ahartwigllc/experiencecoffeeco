import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { toggleMessage } from "../../actions/system";

export default async function MessagesPage() {
  await requireOwner();
  const messages = await db().select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt)).limit(200);
  return (
    <>
      <div className="admin-head">
        <h1>Messages</h1>
      </div>
      <p className="muted small">From the website contact form. Each one was also emailed to you; reply from your inbox.</p>
      {messages.length === 0 && <p className="muted">No messages yet.</p>}
      {messages.map((m) => (
        <div key={m.id} className="card" style={{ opacity: m.handled ? 0.6 : 1 }}>
          <div className="admin-head" style={{ marginBottom: "0.5rem" }}>
            <strong>
              {m.name} <a href={`mailto:${m.email}`}>{m.email}</a>
            </strong>
            <span className="small muted">{formatDateTime(m.createdAt)}</span>
          </div>
          <p style={{ whiteSpace: "pre-wrap", fontFamily: "var(--serif)" }}>{m.message}</p>
          <form action={toggleMessage}>
            <input type="hidden" name="id" value={m.id} />
            <button className="btn btn-small btn-ghost" type="submit">
              {m.handled ? "Mark as not handled" : "Mark handled"}
            </button>
          </form>
        </div>
      ))}
    </>
  );
}
