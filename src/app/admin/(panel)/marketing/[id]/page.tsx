import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash } from "@/components/admin/Flash";
import { db, schema } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { renderCampaign } from "@/lib/campaign";
import { formatDateTime } from "@/lib/dates";
import { siteUrl } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { deleteCampaign, duplicateCampaign, saveCampaign, sendCampaign, sendTestCampaign } from "../../../actions/marketing";

export default async function CampaignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireOwner();
  const { id } = await params;
  const sp = await searchParams;
  const c = await db().query.campaigns.findFirst({ where: eq(schema.campaigns.id, Number(id)) });
  if (!c) notFound();
  const settings = await getSettings();
  const [{ value: audience }] = await db().select({ value: count() }).from(schema.subscribers).where(eq(schema.subscribers.status, "subscribed"));
  const preview = renderCampaign(c, settings, `${siteUrl()}/unsubscribe`);
  const failures = c.status === "sent" && c.failedCount
    ? await db().select().from(schema.campaignSends).where(eq(schema.campaignSends.campaignId, c.id)).limit(50)
    : [];
  const draft = c.status === "draft";

  return (
    <>
      <div className="admin-head">
        <h1>{c.subject}</h1>
        <div className="toolbar">
          <form action={duplicateCampaign}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn btn-small btn-ghost" type="submit">Duplicate</button>
          </form>
          {draft && (
            <form action={deleteCampaign}>
              <input type="hidden" name="id" value={c.id} />
              <ConfirmButton message="Delete this draft?">Delete</ConfirmButton>
            </form>
          )}
          <Link className="btn btn-small btn-ghost" href="/admin/marketing">All emails</Link>
        </div>
      </div>
      <Flash {...sp} />
      {c.status === "sent" && (
        <div className="flash">
          Sent {formatDateTime(c.sentAt)} to {c.recipientCount} people{c.failedCount ? `, ${c.failedCount} failed` : ""}.
        </div>
      )}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div>
          <form action={saveCampaign} className="card admin-form">
            <input type="hidden" name="id" value={c.id} />
            <div className="field"><label htmlFor="subject">Subject</label><input id="subject" name="subject" defaultValue={c.subject} disabled={!draft} /></div>
            <div className="field">
              <label htmlFor="previewText">Preview text <span className="field-hint">The grey line inboxes show after the subject.</span></label>
              <input id="previewText" name="previewText" defaultValue={c.previewText ?? ""} disabled={!draft} />
            </div>
            <div className="field">
              <label htmlFor="bodyMarkdown">Message</label>
              <textarea id="bodyMarkdown" name="bodyMarkdown" rows={16} defaultValue={c.bodyMarkdown} disabled={!draft} style={{ fontFamily: "var(--serif)" }} />
              <span className="field-hint">
                Blank line between paragraphs. # Heading. - bullet. **bold**. [link text](https://…). A button: {"{{button: Shop now | https://experiencecoffee.co/shop}}"}
              </span>
            </div>
            {draft && <div><button className="btn btn-small" type="submit">Save draft</button></div>}
          </form>

          <div className="card">
            <h2>Send a test</h2>
            <form action={sendTestCampaign} className="toolbar">
              <input type="hidden" name="id" value={c.id} />
              <input name="to" type="email" defaultValue={me.email} style={{ maxWidth: 260 }} />
              <button className="btn btn-small btn-ghost" type="submit">Send test</button>
            </form>
            <p className="small muted">Save first; the test uses the saved version.</p>
          </div>

          {draft && (
            <div className="card">
              <h2>Send to {audience} subscribers</h2>
              <form action={sendCampaign} className="admin-form">
                <input type="hidden" name="id" value={c.id} />
                <div className="field">
                  <label htmlFor="confirm">Type SEND to confirm</label>
                  <input id="confirm" name="confirm" autoComplete="off" />
                </div>
                <div><button className="btn btn-cherry" type="submit">Send now</button></div>
              </form>
              <p className="small muted">Every email includes your postal address and a one-click unsubscribe, as US law requires.</p>
            </div>
          )}

          {failures.length > 0 && (
            <div className="card">
              <h2>Failed sends</h2>
              <table className="data"><tbody>
                {failures.filter((f) => f.status === "failed").map((f) => (
                  <tr key={f.id}><td>{f.email}</td><td className="small">{f.error}</td></tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
        <div className="card">
          <h2>Preview</h2>
          <iframe className="email-preview" title="Email preview" srcDoc={preview.html} sandbox="" />
        </div>
      </div>
    </>
  );
}
