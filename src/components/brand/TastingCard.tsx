import { funkiness } from "@/lib/flavor-scale";

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
export function FlavorScale({ process, title }: { process?: string | null; title?: string }) {
  const value = funkiness(process, title);
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
