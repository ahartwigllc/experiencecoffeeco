/** Helpers for turning Shopify product descriptions into structured fields. Pure; unit-tested. */

export function textOf(html: string): string {
  return html.replace(/<\/p>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ");
}

/** Pulls "Flavor Notes: …", "Process: …", "Cupping score: …" out of Shopify descriptions into fields. */
export function parseDescription(title: string, html: string) {
  const text = textOf(html);
  const line = (label: RegExp) => text.split("\n").map((l) => l.trim()).find((l) => label.test(l))?.replace(label, "").replace(/^\s*:\s*/, "").trim() || null;
  const flavorNotes = line(/^flavor\s*notes\s*/i);
  const cupping = line(/^cupping\s*score\s*/i)?.match(/[\d.]+/)?.[0] ?? null;
  const paren = title.match(/\(([^)]+)\)/)?.[1];
  let process = paren && /process|natural|washed|honey|anaerobic/i.test(paren) ? paren.replace(/\s*process$/i, "").trim() : null;
  if (!process) process = line(/^process\s*/i)?.split(/[(,]/)[0]?.trim() || null;
  const countries = ["Ethiopia", "Peru", "Guatemala", "Colombia", "Kenya", "Brazil", "Honduras", "Costa Rica", "Rwanda", "Burundi", "Mexico", "Panama"];
  const origin = countries.find((c) => title.toLowerCase().includes(c.toLowerCase().slice(0, 5))) ?? null;
  // Remove the label paragraphs now shown as structured fields, plus empty paragraphs.
  const cleaned = html
    .split(/(?=<p[\s>])/i)
    .filter((p) => {
      const t = textOf(p).trim();
      return t !== "" && !/^(flavor\s*notes|process|cupping\s*score)\s*:/i.test(t);
    })
    .join("")
    .trim();
  return { flavorNotes, cuppingScore: cupping, process, origin, descriptionHtml: cleaned };
}

