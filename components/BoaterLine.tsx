import type { Tide } from "@/lib/core/tides";
import type { Wind } from "@/lib/core/wind";
import { fmtTime } from "@/lib/core/time";

// One line a boater reads at a glance: wind, the next tide, the radio channel.
export function BoaterLine({ wind, tides, tz, now, vhf, position }: {
  wind: Wind | null; tides: Tide[]; tz: string; now: Date; vhf?: string; position?: string | null;
}) {
  const next = tides.find((t) => t.at > now);
  const bits = [
    wind && `Wind ${wind.from} ${wind.speed}${wind.gust ? `, gusts ${wind.gust}` : ""}`,
    next && `${next.high ? "High" : "Low"} water ${fmtTime(next.at, tz)}`,
    vhf && `VHF ${vhf}`,
    position,
  ].filter(Boolean);
  if (bits.length === 0) return null;
  return <p className="boater">{bits.map((b, i) => <span key={i}>{b}</span>)}</p>;
}
