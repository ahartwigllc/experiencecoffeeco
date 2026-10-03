import { escapeHtml } from "./markdown";
import { siteUrl } from "./env";

/**
 * Email via Resend's HTTP API (no SDK, works on Workers). When RESEND_API_KEY is
 * missing, emails are logged and skipped so local development never blocks.
 */
export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  replyTo?: string;
};

export type SendResult = { ok: boolean; id?: string; error?: string; skipped?: boolean };

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Experience Coffee <hello@experiencecoffee.co>";
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function payload(m: Mail) {
  return {
    from: fromAddress(),
    to: m.to,
    subject: m.subject,
    html: m.html,
    text: m.text,
    headers: m.headers,
    reply_to: m.replyTo,
  };
}

export async function sendEmail(m: Mail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email skipped: RESEND_API_KEY not set] "${m.subject}" -> ${String(m.to)}`);
    return { ok: false, skipped: true, error: "Email isn't set up yet. Add RESEND_API_KEY." };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload(m)),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) return { ok: false, error: data.message || `Resend returned HTTP ${res.status}` };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/** Sends up to 100 messages in one request (Resend batch limit). */
export async function sendBatch(messages: Mail[]): Promise<SendResult[]> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return messages.map(() => ({ ok: false, skipped: true, error: "RESEND_API_KEY not set" }));
  if (messages.length > 100) throw new Error("sendBatch accepts at most 100 messages");
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(messages.map(payload)),
    });
    const data = (await res.json().catch(() => ({}))) as { data?: { id: string }[]; message?: string };
    if (!res.ok) return messages.map(() => ({ ok: false, error: data.message || `HTTP ${res.status}` }));
    return messages.map((_, i) => ({ ok: true, id: data.data?.[i]?.id }));
  } catch (err) {
    const error = err instanceof Error ? err.message : "Network error";
    return messages.map(() => ({ ok: false, error }));
  }
}

/* ---------------------------------------------------------------- layout */

const C = { ink: "#2A1A14", red: "#8E1C2E", sage: "#E4E8DA", muted: "#6B5E57" };

export function emailLayout(opts: { title: string; bodyHtml: string; preview?: string; footerHtml?: string }): string {
  const preview = opts.preview
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preview)}</div>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;background:${C.sage};font-family:Georgia,'Times New Roman',serif;color:${C.ink};">${preview}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.sage};padding:32px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;">
<tr><td style="padding:28px 32px 0;font-family:Arial,Helvetica,sans-serif;font-weight:800;letter-spacing:-0.02em;font-size:20px;color:${C.red};">Experience Coffee</td></tr>
<tr><td style="padding:12px 32px 28px;font-size:16px;line-height:1.6;">
<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;margin:8px 0 16px;">${escapeHtml(opts.title)}</h1>
${opts.bodyHtml}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="padding:16px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${C.muted};">
${opts.footerHtml ?? `<a href="${siteUrl()}" style="color:${C.muted};">experiencecoffee.co</a>`}
</td></tr></table>
</td></tr></table></body></html>`;
}

export function button(label: string, href: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="background:${C.red};color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:600;display:inline-block;">${escapeHtml(label)}</a></p>`;
}
