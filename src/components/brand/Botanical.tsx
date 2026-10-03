/**
 * Line-art coffee branch and beans, drawn in the spirit of the botanical illustrations
 * on the Canva bag and card designs. Stroke uses currentColor so CSS sets the tone.
 */
function Leaf({ d, vein }: { d: string; vein: string }) {
  return (
    <g>
      <path d={d} />
      <path d={vein} className="bt-fine" />
    </g>
  );
}

function Cherry({ cx, cy, r = 5.5 }: { cx: number; cy: number; r?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} />
      <path d={`M ${cx - r * 0.35} ${cy - r * 0.2} q ${r * 0.35} ${r * 0.45} ${r * 0.7} 0`} className="bt-fine" />
    </g>
  );
}

export function Branch({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  return (
    <svg
      className={`botanical ${className}`}
      viewBox="0 0 220 260"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {/* main stem */}
        <path d="M 30 250 C 60 200, 80 160, 110 120 S 170 50, 200 20" />
        <path d="M 110 120 C 90 110, 70 108, 48 112" />
        <path d="M 150 72 C 160 90, 162 108, 158 128" />
        {/* leaves */}
        <Leaf d="M 48 112 C 30 100, 14 102, 4 112 C 18 124, 36 124, 48 112 Z" vein="M 48 112 C 34 112, 20 112, 6 112" />
        <Leaf d="M 80 166 C 60 150, 40 152, 26 164 C 44 178, 66 178, 80 166 Z" vein="M 80 166 C 62 165, 44 165, 28 164" />
        <Leaf d="M 96 140 C 108 118, 128 112, 142 116 C 134 134, 116 146, 96 140 Z" vein="M 96 140 C 110 132, 124 124, 140 117" />
        <Leaf d="M 158 128 C 146 146, 148 166, 158 180 C 170 164, 170 144, 158 128 Z" vein="M 158 128 C 158 144, 158 160, 158 178" />
        <Leaf d="M 176 46 C 186 26, 204 18, 216 20 C 210 38, 194 50, 176 46 Z" vein="M 176 46 C 188 38, 200 30, 214 21" />
        <Leaf d="M 130 92 C 112 80, 112 60, 120 46 C 134 58, 138 76, 130 92 Z" vein="M 130 92 C 126 78, 122 62, 121 48" />
        <Leaf d="M 56 210 C 40 200, 22 204, 12 214 C 28 224, 46 222, 56 210 Z" vein="M 56 210 C 42 211, 28 212, 14 214" />
        {/* cherry clusters */}
        <Cherry cx={112} cy={128} />
        <Cherry cx={121} cy={134} />
        <Cherry cx={104} cy={136} />
        <Cherry cx={114} cy={142} r={5} />
        <Cherry cx={63} cy={188} />
        <Cherry cx={72} cy={194} r={5} />
        <Cherry cx={58} cy={198} r={5} />
        <Cherry cx={160} cy={68} r={5} />
        <Cherry cx={168} cy={74} r={4.5} />
      </g>
    </svg>
  );
}

export function Bean({ className = "", rotate = 0 }: { className?: string; rotate?: number }) {
  return (
    <svg className={`bean ${className}`} viewBox="0 0 40 28" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <ellipse cx="20" cy="14" rx="17" ry="11" />
        <path d="M 5 15 C 12 9, 20 19, 35 12" />
      </g>
    </svg>
  );
}

/** A loose scatter of branches and beans for section backgrounds, like the Canva covers. */
export function BotanicalField({ variant = "hero" }: { variant?: "hero" | "soft" }) {
  return (
    <div className={`botanical-field botanical-${variant}`} aria-hidden="true">
      <Branch className="bf-1" />
      <Branch className="bf-2" flip />
      <Branch className="bf-3" />
      <Bean className="bb-1" rotate={-20} />
      <Bean className="bb-2" rotate={35} />
      <Bean className="bb-3" rotate={10} />
      <Bean className="bb-4" rotate={-45} />
      <Bean className="bb-5" rotate={70} />
      <Bean className="bb-6" rotate={-5} />
    </div>
  );
}
