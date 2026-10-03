import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap narrow" style={{ padding: "4rem var(--gutter)" }}>
      <h1 className="tasting-line" style={{ fontSize: "var(--step-4)" }}>
        <span>Nothing</span>
        <span>brewing here.</span>
      </h1>
      <p className="lede">That page doesn't exist, or the coffee sold out and moved on.</p>
      <Link className="btn" href="/shop">
        See current coffee
      </Link>
    </main>
  );
}
