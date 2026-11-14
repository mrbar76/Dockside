// The club's initials flown as International Code of Signals flags, the way a
// boat dresses ship. Only letters drawn below are flown; others are left out.
const RED = "#C8102E", BLUE = "#1F3E97", YEL = "#FFD100", BLK = "#111111", WHT = "#FFFFFF";
const W = 30, H = 22;

function Flag({ letter }: { letter: string }) {
  const r = (x: number, y: number, w: number, h: number, f: string, k?: string) => <rect key={k ?? `${x}${y}${f}`} x={x} y={y} width={w} height={h} fill={f} />;
  const stripes = (cols: string[], vertical = false) =>
    cols.map((c, i) => vertical ? r((W / cols.length) * i, 0, W / cols.length + 0.2, H, c, `${i}`) : r(0, (H / cols.length) * i, W, H / cols.length + 0.2, c, `${i}`));
  switch (letter) {
    case "A": return <><path d={`M0 0H${W / 2}V${H}H0Z`} fill={WHT} /><path d={`M${W / 2} 0H${W}L${W * 0.72} ${H / 2}L${W} ${H}H${W / 2}Z`} fill={BLUE} /></>;
    case "B": return <path d={`M0 0H${W}L${W * 0.72} ${H / 2}L${W} ${H}H0Z`} fill={RED} />;
    case "C": return <>{stripes([BLUE, WHT, RED, WHT, BLUE])}</>;
    case "D": return <>{r(0, 0, W, H, YEL)}{r(0, H * 0.25, W, H * 0.5, BLUE)}</>;
    case "E": return <>{r(0, 0, W, H / 2, BLUE)}{r(0, H / 2, W, H / 2, RED)}</>;
    case "F": return <>{r(0, 0, W, H, WHT)}<path d={`M${W / 2} 1L${W - 2} ${H / 2}L${W / 2} ${H - 1}L2 ${H / 2}Z`} fill={RED} /></>;
    case "G": return <>{stripes([YEL, BLUE, YEL, BLUE, YEL, BLUE], true)}</>;
    case "H": return <>{r(0, 0, W / 2, H, WHT)}{r(W / 2, 0, W / 2, H, RED)}</>;
    case "I": return <>{r(0, 0, W, H, YEL)}<circle cx={W / 2} cy={H / 2} r={H * 0.27} fill={BLK} /></>;
    case "J": return <>{stripes([BLUE, WHT, BLUE])}</>;
    case "K": return <>{r(0, 0, W / 2, H, YEL)}{r(W / 2, 0, W / 2, H, BLUE)}</>;
    case "L": return <>{r(0, 0, W / 2, H / 2, YEL)}{r(W / 2, 0, W / 2, H / 2, BLK)}{r(0, H / 2, W / 2, H / 2, BLK)}{r(W / 2, H / 2, W / 2, H / 2, YEL)}</>;
    case "M": return <>{r(0, 0, W, H, BLUE)}<path d={`M0 0L${W} ${H}M${W} 0L0 ${H}`} stroke={WHT} strokeWidth={H * 0.22} /></>;
    case "N": return <>{[0, 1, 2, 3].flatMap((y) => [0, 1, 2, 3].map((x) => r((W / 4) * x, (H / 4) * y, W / 4 + 0.2, H / 4 + 0.2, (x + y) % 2 ? WHT : BLUE, `${x}-${y}`)))}</>;
    case "P": return <>{r(0, 0, W, H, BLUE)}{r(W * 0.3, H * 0.3, W * 0.4, H * 0.4, WHT)}</>;
    case "Q": return <>{r(0, 0, W, H, YEL)}</>;
    case "R": return <>{r(0, 0, W, H, RED)}{r(W * 0.42, 0, W * 0.16, H, YEL)}{r(0, H * 0.39, W, H * 0.22, YEL)}</>;
    case "S": return <>{r(0, 0, W, H, WHT)}{r(W * 0.3, H * 0.3, W * 0.4, H * 0.4, BLUE)}</>;
    case "T": return <>{stripes([RED, WHT, BLUE], true)}</>;
    case "U": return <>{r(0, 0, W / 2, H / 2, RED)}{r(W / 2, 0, W / 2, H / 2, WHT)}{r(0, H / 2, W / 2, H / 2, WHT)}{r(W / 2, H / 2, W / 2, H / 2, RED)}</>;
    case "V": return <>{r(0, 0, W, H, WHT)}<path d={`M0 0L${W} ${H}M${W} 0L0 ${H}`} stroke={RED} strokeWidth={H * 0.22} /></>;
    case "W": return <>{r(0, 0, W, H, BLUE)}{r(W * 0.17, H * 0.17, W * 0.66, H * 0.66, WHT)}{r(W * 0.34, H * 0.34, W * 0.32, H * 0.32, RED)}</>;
    case "X": return <>{r(0, 0, W, H, WHT)}{r(W * 0.42, 0, W * 0.16, H, BLUE)}{r(0, H * 0.39, W, H * 0.22, BLUE)}</>;
    case "Y": return <>{r(0, 0, W, H, YEL)}{[-2, 0, 2, 4, 6].map((i) => <path key={i} d={`M${i * 6} 0L${i * 6 + 6} 0L${i * 6 + 6 - H} ${H}L${i * 6 - H} ${H}Z`} fill={RED} />)}</>;
    default: return null;
  }
}

export function FlagHoist({ word }: { word: string }) {
  const letters = [...word.toUpperCase()].filter((c) => c !== "O" && c !== "Z" && /[A-Z]/.test(c));
  if (letters.length === 0) return null;
  const gap = 10, pad = 14, width = pad * 2 + letters.length * W + (letters.length - 1) * gap;
  return (
    <div className="hoist" aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${H + 14}`} width={width} height={H + 14}>
        <path d={`M0 4 Q ${width / 2} 10 ${width} 4`} fill="none" stroke="currentColor" strokeWidth="1.2" />
        {letters.map((c, i) => {
          const x = pad + i * (W + gap);
          return (
            <g key={i} transform={`translate(${x} 8)`}>
              <clipPath id={`flag-${c}-${i}`}><rect width={W} height={H} /></clipPath>
              <g clipPath={`url(#flag-${c}-${i})`}><Flag letter={c} /></g>
              <rect width={W} height={H} fill="none" stroke="#000" strokeOpacity=".35" strokeWidth=".8" />
            </g>
          );
        })}
      </svg>
      <span className="hoist-word">{letters.join(" ")} in signal flags</span>
    </div>
  );
}
