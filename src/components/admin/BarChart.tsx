import { formatCents } from "@/lib/money";

/** Revenue (sage) vs net profit (cherry, or honey for a loss) per period. Pure SVG, no library. */
export function BarChart({ data }: { data: { label: string; revenue: number; profit: number }[] }) {
  if (!data.length) return <p className="muted">No data in this range yet.</p>;
  const W = 760;
  const H = 240;
  const padL = 56;
  const padB = 28;
  const padT = 10;
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.profit)));
  const min = Math.min(0, ...data.map((d) => d.profit));
  const span = max - min;
  const y = (v: number) => padT + ((max - v) / span) * (H - padT - padB);
  const slot = (W - padL) / data.length;
  const bw = Math.max(4, Math.min(28, slot / 2.6));
  const ticks = [max, max / 2, 0, ...(min < 0 ? [min] : [])];

  return (
    <figure style={{ margin: 0 }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue and profit by period">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#e3e6da" />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end">
              {formatCents(Math.round(t)).replace(".00", "")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * slot + slot / 2;
          const zero = y(0);
          return (
            <g key={d.label}>
              <rect className="bar-rev" x={x - bw - 1} y={y(d.revenue)} width={bw} height={Math.max(0, zero - y(d.revenue))}>
                <title>{`${d.label} revenue ${formatCents(d.revenue)}`}</title>
              </rect>
              <rect
                className={d.profit >= 0 ? "bar-profit" : "bar-loss"}
                x={x + 1}
                y={d.profit >= 0 ? y(d.profit) : zero}
                width={bw}
                height={Math.abs(y(d.profit) - zero)}
              >
                <title>{`${d.label} profit ${formatCents(d.profit)}`}</title>
              </rect>
              {(data.length <= 14 || i % Math.ceil(data.length / 12) === 0) && (
                <text x={x} y={H - 8} textAnchor="middle">
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="legend">
        <span>
          <i style={{ background: "var(--sage-deep)" }} />
          Revenue
        </span>
        <span>
          <i style={{ background: "var(--cherry)" }} />
          Net profit
        </span>
        <span>
          <i style={{ background: "var(--honey)" }} />
          Loss
        </span>
      </figcaption>
    </figure>
  );
}
