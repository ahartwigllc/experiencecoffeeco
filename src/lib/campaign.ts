import type { Campaign } from "@/db/schema";
import { emailLayout } from "./email";
import { escapeHtml, markdownToHtml, markdownToText } from "./markdown";
import type { Settings } from "./settings";

export function renderCampaign(c: Pick<Campaign, "subject" | "previewText" | "bodyMarkdown">, s: Settings, unsubscribeUrl: string) {
  const footer = `You're getting this because you signed up for emails from ${escapeHtml(s.businessName)}.<br>
${escapeHtml(s.businessPostalAddress)}<br>
<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6B5E57;">Unsubscribe</a>`;
  return {
    html: emailLayout({ title: c.subject, bodyHtml: markdownToHtml(c.bodyMarkdown), preview: c.previewText ?? undefined, footerHtml: footer }),
    text: `${c.subject}\n\n${markdownToText(c.bodyMarkdown)}\n\n--\n${s.businessName}, ${s.businessPostalAddress}\nUnsubscribe: ${unsubscribeUrl}`,
  };
}
