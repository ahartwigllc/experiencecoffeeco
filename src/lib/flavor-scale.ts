/**
 * Where a coffee sits on the "Clean ↔ Funky" scale (0–100), from its processing method.
 * Washed coffees taste clean; naturals and long anaerobic ferments taste wilder.
 * Returns null when there is nothing to go on (e.g. cold brew without a process).
 */
export function funkiness(process?: string | null, title?: string | null): number | null {
  const s = `${process ?? ""} ${title ?? ""}`.toLowerCase();
  if (!process && !/washed|natural|honey|anaerobic/.test(s)) return null;
  let v = 50;
  if (/washed/.test(s)) v = 18;
  if (/honey/.test(s)) v = 42;
  if (/natural/.test(s)) v = 66;
  if (/anaerobic/.test(s)) v = /natural/.test(s) ? 92 : 80;
  return v;
}
