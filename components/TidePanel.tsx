import { heightAt, type Tide } from "@/lib/core/tides";
import { fmtTime, fmtWeekday } from "@/lib/core/time";

// The harbor's next day of water, drawn from NOAA's high and low predictions.
export function TidePanel({ tides, tz, now, place }: { tides: Tide[]; tz: string; now: Date; place: string }) {
  const next = tides.find((t) => t.at > now);
  if (!next || tides.length < 3) return null;
  const start = now.getTime() - 2 * 3600000, end = now.getTime() + 22 * 3600000;
  const W = 640, H = 170, top = 34, bottom = 30;
  const pts: [number, number][] = [];
  for (let t = start; t <= end; t += 20 * 60000) {
    const h = heightAt(tides, new Date(t));
    if (h != null) pts.push([t, h]);
  }
  if (pts.length < 2) return null;
  const hs = pts.map((p) => p[1]);
  const lo = Math.min(...hs), hi = Math.max(...hs);
  const x = (t: number) => ((t - start) / (end - start)) * W;
  const y = (h: number) => top + (1 - (h - lo) / (hi - lo || 1)) * (H - top - bottom);
  const line = pts.map(([t, h], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(h).toFixed(1)}`).join(" ");
  const turns = tides.filter((t) => t.at > now && t.at.getTime() <= end); // label only what is still to come
  const later = tides.filter((t) => t.at > next.at).slice(0, 3);
  const word = (t: Tide) => (t.high ? "High" : "Low");
  return (
    <figure className="tide">
      <figcaption>
        <p className="small">{place}</p>
        <p className="next">{word(next)} water at {fmtTime(next.at, tz)}, {next.ft.toFixed(1)} ft</p>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tide curve for the next day. ${word(next)} water at ${fmtTime(next.at, tz)}.`}>
        <path className="water" d={`${line} L${W},${H} L0,${H} Z`} />
        <line className="now" x1={x(now.getTime())} x2={x(now.getTime())} y1={top - 14} y2={H} />
        <text x={x(now.getTime()) + 6} y={top - 18}>now</text>
        {turns.map((t) => {
          const px = x(t.at.getTime());
          if (px - x(now.getTime()) < 70) return null; // too close to the "now" line; the headline already says it
          return (
            <text key={t.at.toISOString()} x={Math.min(Math.max(px, 62), W - 62)} y={t.high ? y(t.ft) - 9 : y(t.ft) + 21} textAnchor="middle">
              {fmtTime(t.at, tz)} {t.ft.toFixed(1)} ft
            </text>
          );
        })}
      </svg>
      <ul className="later">
        {later.map((t) => (
          <li key={t.at.toISOString()}>{word(t)} {fmtWeekday(t.at, tz)} {fmtTime(t.at, tz)}, {t.ft.toFixed(1)} ft</li>
        ))}
      </ul>
    </figure>
  );
}
