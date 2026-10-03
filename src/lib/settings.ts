import { db, schema } from "@/db/client";
import { DEFAULT_SETTINGS, type Settings } from "./settings-defaults";

export { DEFAULT_SETTINGS, type Settings };

export async function getSettings(): Promise<Settings> {
  try {
    const rows = await db().select().from(schema.settings);
    const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
    return merged as Settings;
  } catch (err) {
    console.error("getSettings failed, using defaults", err);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const entries = Object.entries(patch).filter(([k, v]) => k in DEFAULT_SETTINGS && v !== undefined);
  for (const [key, value] of entries) {
    await db()
      .insert(schema.settings)
      .values({ key, value: value as never })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: value as never, updatedAt: new Date() } });
  }
}
