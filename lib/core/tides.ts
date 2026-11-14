// High and low tide predictions from NOAA (free, no key). Fails quiet: a club
// page must never break because a government server is slow.
export type Tide = { at: Date; ft: number; high: boolean };

export async function getTides(station: string | undefined, now = new Date()): Promise<Tide[]> {
  if (!station) return [];
  const begin = new Date(now.getTime() - 24 * 3600000).toISOString().slice(0, 10).replace(/-/g, "");
  const url =
    "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&application=dockside" +
    `&begin_date=${begin}&range=96&datum=MLLW&station=${station}&time_zone=gmt&units=english&interval=hilo&format=json`;
  try {
    const res = await fetch(url, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const json = (await res.json()) as { predictions?: { t: string; v: string; type: string }[] };
    return (json.predictions ?? []).map((p) => ({
      at: new Date(p.t.replace(" ", "T") + ":00Z"), ft: Number(p.v), high: p.type === "H",
    }));
  } catch {
    return [];
  }
}

// Water height between two turning points follows a half cosine closely enough to draw.
export function heightAt(tides: Tide[], t: Date): number | null {
  for (let i = 0; i < tides.length - 1; i++) {
    const a = tides[i], b = tides[i + 1];
    if (t >= a.at && t <= b.at) {
      const f = (t.getTime() - a.at.getTime()) / (b.at.getTime() - a.at.getTime());
      return a.ft + (b.ft - a.ft) * (1 - Math.cos(Math.PI * f)) / 2;
    }
  }
  return null;
}
