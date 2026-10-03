/* eslint-disable @next/next/no-img-element */
/**
 * The Experience Coffee logo, exported from Canva ("Logo Work"):
 * "Experience" with the tan x and tracked COFFEE underneath.
 * `tone="cream"` is the same artwork recolored for dark backgrounds.
 */
export function Wordmark({
  size = "md",
  tone = "ink",
  as: Tag = "span",
  priority = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "ink" | "cream";
  as?: "span" | "div" | "h1";
  priority?: boolean;
}) {
  const src = tone === "cream" ? "/img/brand/logo-cream.png" : "/img/brand/logo.png";
  return (
    <Tag className={`wm wm-${size}`}>
      <img src={src} alt="Experience Coffee" width={951} height={199} fetchPriority={priority ? "high" : undefined} decoding="async" />
    </Tag>
  );
}

/** The X monogram with COFFEE arcing over it, from the bag front. */
export function Monogram({ className = "" }: { className?: string }) {
  return <img className={`monogram ${className}`} src="/img/brand/monogram.png" alt="Experience Coffee" width={445} height={466} />;
}
