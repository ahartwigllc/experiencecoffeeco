import Link from "next/link";
import { funkiness } from "@/lib/flavor-scale";
import { GRADE_BANDS, gradeBand, gradePosition, parseScore } from "@/lib/grade";

/**
 * The bag label from the Canva designs: an espresso panel with
 * TASTING NOTES across the top, ORIGIN | PROCESS, then the bag size.
 */
export function TastingCard({
  notes,
  origin,
  process,
  footer,
  score,
}: {
  notes?: string | null;
  origin?: string | null;
  process?: string | null;
  footer?: string | null;
  score?: string | null;
}) {
  if (!notes && !origin && !process) return null;
  return (
    <div className="tasting-card">
      {notes ? (
        <div className="tc-row">
          <p className="tc-label">Tasting notes</p>
          <p className="tc-value">{notes}</p>
        </div>
      ) : null}
      {origin || process ? (
        <div className="tc-row tc-split">
          <div>
            <p className="tc-label">Origin</p>
            <p className="tc-value">{origin || "—"}</p>
          </div>
          <div>
            <p className="tc-label">Process</p>
            <p className="tc-value">{process || "—"}</p>
          </div>
        </div>
      ) : null}
      {footer || score ? (
        <div className="tc-row">
          <p className="tc-label">{footer || "Whole beans"}</p>
          {score ? <p className="tc-value">{score} cupping score</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/** "Clean ↔ Funky" bar from the Canva cover, placed by processing method. */
export function FlavorScale({ process, title, level }: { process?: string | null; title?: string; level?: number | null }) {
  const value = funkiness(process, title, level);
  if (value === null) return null;
  return (
    <div className="flavor-scale" role="img" aria-label={`Flavor style: ${value < 40 ? "clean" : value > 65 ? "funky" : "balanced"}`}>
      <div className="fs-ends" aria-hidden="true">
        <span>Clean</span>
        <span>Funky</span>
      </div>
      <div className="fs-track" aria-hidden="true">
        <span className="fs-dot" style={{ left: `${value}%` }} />
      </div>
    </div>
  );
}

/** Grade bar: where the cupping score sits from 80 (specialty) to 100, with a link to how grading works. */
export function GradeScale({ score, label }: { score?: string | null; label?: string | null }) {
  const n = parseScore(score);
  if (n === null) return null;
  const band = gradeBand(n);
  return (
    <div className="grade-scale">
      <div className="gs-head">
        <span className="gs-label">Grade</span>
        <span className="gs-score">
          {String(Number(n.toFixed(2)))} <small>/ 100</small>
        </span>
      </div>
      <p className="gs-band">
        {band ? `${band.label} · ${band.blurb}` : "Below specialty grade"}
        {label ? <span className="gs-extra"> · {label}</span> : null}
      </p>
      <div className="gs-track" role="img" aria-label={`Cupping score ${n} out of 100${band ? `, ${band.label.toLowerCase()}` : ""}`}>
        {GRADE_BANDS.map((b) => (
          <span
            key={b.label}
            className={`gs-band-seg ${band?.label === b.label ? "on" : ""}`}
            style={{ left: `${gradePosition(b.from)}%`, width: `${gradePosition(Math.min(b.to, 100)) - gradePosition(b.from)}%` }}
          />
        ))}
        <span className="gs-dot" style={{ left: `${gradePosition(n)}%` }} />
      </div>
      <div className="gs-ticks" aria-hidden="true">
        <span style={{ left: "0%" }}>80</span>
        <span style={{ left: "25%" }}>85</span>
        <span style={{ left: "50%" }}>90</span>
        <span style={{ left: "100%" }}>100</span>
      </div>
      <Link className="gs-link" href="/grading">
        How coffee is graded
      </Link>
    </div>
  );
}
