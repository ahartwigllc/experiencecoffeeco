import type { Metadata } from "next";
import { AjaxForm } from "@/components/AjaxForm";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const s = await getSettings();
  return (
    <div className="wrap narrow">
      <div className="page-head">
        <h1>Say hello</h1>
        <p className="lede">Questions about a coffee, wholesale, or an order? Send a note and one of us will reply, usually the same day.</p>
      </div>
      <AjaxForm action="/api/contact" submitLabel="Send message">
        <div className="field">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" name="name" type="text" autoComplete="name" required maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input id="c-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="c-msg">Message</label>
          <textarea id="c-msg" name="message" required maxLength={5000} />
        </div>
      </AjaxForm>
      <div className="notice">
        Pickup: {s.pickupAddress}
        {s.phone ? <>. Phone: {s.phone}</> : null}. Email: <a href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a>
      </div>
    </div>
  );
}
