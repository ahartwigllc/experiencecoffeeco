/**
 * Cupping-score grade bands (100-point scale used for specialty coffee).
 * 80+ is specialty grade; most of the world's coffee scores below that.
 */
export const GRADE_MIN = 80;
export const GRADE_MAX = 100;

export const GRADE_BANDS = [
  { from: 80, to: 85, label: "Very good", blurb: "Specialty grade" },
  { from: 85, to: 90, label: "Excellent", blurb: "Top tier of specialty" },
  { from: 90, to: 100.01, label: "Outstanding", blurb: "Rare, competition-level" },
] as const;

export function parseScore(score?: string | number | null): number | null {
  if (score === null || score === undefined || score === "") return null;
  const n = typeof score === "number" ? score : Number(String(score).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

/** Band for a score, or null below specialty grade. */
export function gradeBand(score: number) {
  return GRADE_BANDS.find((b) => score >= b.from && score < b.to) ?? null;
}

/** Position (0–100%) of a score on the 80–100 bar. */
export function gradePosition(score: number): number {
  const p = ((score - GRADE_MIN) / (GRADE_MAX - GRADE_MIN)) * 100;
  return Math.max(0, Math.min(100, Math.round(p * 10) / 10));
}
