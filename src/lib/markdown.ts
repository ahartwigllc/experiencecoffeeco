/**
 * Minimal, safe Markdown -> HTML for marketing emails written in the admin.
 * Supports: # / ## / ### headings, paragraphs, - bullet lists, **bold**, _italic_,
 * [links](https://...), and {{button: Label | https://url}} call-to-action buttons.
 * All input is HTML-escaped first, so admins can't accidentally inject markup.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
}

function inline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, url: string) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${escapeHtml(href)}" style="color:#8E1C2E;">${label}</a>` : label;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, "$1<em>$2</em>");
  return out;
}

export function markdownToHtml(md: string): string {
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const html: string[] = [];
  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const button = /^\{\{\s*button:\s*(.+?)\s*\|\s*(\S+?)\s*\}\}$/i.exec(block);
    if (button) {
      const href = safeUrl(button[2]!);
      if (href)
        html.push(
          `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="background:#8E1C2E;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(button[1]!)}</a></p>`,
        );
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(block);
    if (heading && !block.includes("\n")) {
      const level = heading[1]!.length + 1; // # -> h2 (h1 reserved for the email title)
      html.push(`<h${level} style="margin:24px 0 8px;">${inline(heading[2]!)}</h${level}>`);
      continue;
    }
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      html.push(`<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`);
      continue;
    }
    html.push(`<p style="margin:0 0 16px;">${lines.map(inline).join("<br>")}</p>`);
  }
  return html.join("\n");
}

export function markdownToText(md: string): string {
  return md
    .replace(/\{\{\s*button:\s*(.+?)\s*\|\s*(\S+?)\s*\}\}/gi, "$1: $2")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{1,3}\s+/gm, "");
}
