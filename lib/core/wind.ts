import { getStationLatLng, getStationPosition } from "./tides";

// Wind for the next hour from the National Weather Service. Free, no key.
// Any failure returns null and the page simply leaves wind out.
const UA = { "user-agent": "Dockside club app (hello@dockside.club)", accept: "application/geo+json" };

export type Wind = { speed: string; from: string; gust?: string };

export async function getWind(point: [number, number] | null | undefined): Promise<Wind | null> {
  if (!point) return null;
  const [lat, lng] = point;
  try {
    const p = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`, { headers: UA, next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) });
    if (!p.ok) return null;
    const hourly = ((await p.json()) as { properties?: { forecastHourly?: string } }).properties?.forecastHourly;
    if (!hourly) return null;
    const f = await fetch(hourly, { headers: UA, next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) });
    if (!f.ok) return null;
    const now = ((await f.json()) as { properties?: { periods?: { windSpeed?: string; windDirection?: string; windGust?: string | null }[] } }).properties?.periods?.[0];
    if (!now?.windSpeed || !now.windDirection) return null;
    return { speed: toKnots(now.windSpeed), from: now.windDirection, gust: now.windGust ? toKnots(now.windGust) : undefined };
  } catch {
    return null;
  }
}

// "10 mph" or "5 to 10 mph" becomes knots, the unit boaters use.
export function toKnots(s: string) {
  const nums = (s.match(/\d+/g) ?? []).map((n) => Math.round(Number(n) * 0.868976));
  if (nums.length === 0) return s;
  return `${nums.join(" to ")} kt`;
}


// Wind and charted position for a club, both cached and both optional.
export async function getConditions(settings: { nwsPoint?: [number, number]; noaaStation?: string }) {
  const [ll, position] = await Promise.all([
    settings.nwsPoint ? Promise.resolve(null) : getStationLatLng(settings.noaaStation),
    getStationPosition(settings.noaaStation),
  ]);
  const point = settings.nwsPoint ?? (ll ? ([ll.lat, ll.lng] as [number, number]) : null);
  return { wind: await getWind(point), position };
}
