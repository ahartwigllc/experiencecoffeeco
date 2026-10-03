/**
 * The Experience Coffee wordmark, set in type so it stays crisp at any size:
 * "Experience" in a high-contrast serif with the x in tan, "COFFEE" tracked out underneath.
 * Matches the Canva "Logo Work" lockup.
 */
export function Wordmark({ size = "md", tone = "ink", as: Tag = "span" }: { size?: "sm" | "md" | "lg" | "xl"; tone?: "ink" | "cream"; as?: "span" | "div" | "h1" }) {
  return (
    <Tag className={`wm wm-${size} wm-${tone}`} aria-label="Experience Coffee">
      <span className="wm-word" aria-hidden="true">
        E<span className="wm-x">x</span>perience
      </span>
      <span className="wm-sub" aria-hidden="true">
        Coffee
      </span>
    </Tag>
  );
}

/** The stand-alone X monogram with "coffee" arcing around its top right, from the bag front. */
export function Monogram({ className = "" }: { className?: string }) {
  return (
    <svg className={`monogram ${className}`} viewBox="0 0 120 120" role="img" aria-label="Experience Coffee">
      <defs>
        <path id="mono-arc" d="M 62 40 A 30 30 0 0 1 104 70" />
      </defs>
      <text className="monogram-x" x="14" y="112">X</text>
      <text className="monogram-arc">
        <textPath href="#mono-arc">COFFEE</textPath>
      </text>
    </svg>
  );
}
