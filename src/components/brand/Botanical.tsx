/* eslint-disable @next/next/no-img-element */
/**
 * The coffee branch, cherry and bean line art from the Canva bag and card designs.
 * Tan versions sit on cream; gold versions sit on the black cold brew band.
 */
type BranchName = "a" | "b" | "c";
const SIZES: Record<BranchName, [number, number]> = { a: [659, 607], b: [570, 561], c: [609, 533] };

export function Branch({ name = "a", gold = false, className = "" }: { name?: BranchName; gold?: boolean; className?: string }) {
  const [w, h] = SIZES[name];
  return (
    <img
      className={`botanical ${className}`}
      src={`/img/brand/branch-${name}${gold ? "-gold" : ""}.png`}
      alt=""
      aria-hidden="true"
      width={w}
      height={h}
      loading="lazy"
      decoding="async"
    />
  );
}

export function Beans({ alt = false, className = "" }: { alt?: boolean; className?: string }) {
  return (
    <img
      className={`bean ${className}`}
      src={alt ? "/img/brand/beans-b.png" : "/img/brand/beans.png"}
      alt=""
      aria-hidden="true"
      width={alt ? 151 : 183}
      height={alt ? 112 : 190}
      loading="lazy"
      decoding="async"
    />
  );
}

/** Branches and beans scattered around a section, like the Canva covers. */
export function BotanicalField({ variant = "hero" }: { variant?: "hero" | "soft" }) {
  return (
    <div className={`botanical-field botanical-${variant}`} aria-hidden="true">
      <Branch name="a" className="bf-1" />
      <Branch name="b" className="bf-2" />
      <Branch name="c" className="bf-3" />
      <Beans className="bb-1" />
      <Beans alt className="bb-2" />
      <Beans alt className="bb-3" />
    </div>
  );
}
