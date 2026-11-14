// Dates are stored in UTC and shown in the club's own time zone.
const parts = (d: Date, tz: string) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

export function tzOffsetMs(d: Date, tz: string): number {
  const p = parts(d, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

// "2026-11-20T18:30" typed by an officer in the club's zone -> a UTC Date.
export function zonedToUtc(local: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error("Enter a date and time.");
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const first = new Date(guess - tzOffsetMs(new Date(guess), tz));
  return new Date(guess - tzOffsetMs(first, tz));
}

export const dayKey = (d: Date, tz: string) => { const p = parts(d, tz); return `${p.year}-${p.month}-${p.day}`; };
export const fmtDay = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" }).format(d);
export const fmtDayShort = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
export const fmtWeekday = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
export const fmtDayNum = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(d);
export const fmtTime = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).toLowerCase();
export const fmtWhen = (d: Date, tz: string) => `${fmtDayShort(d, tz)} at ${fmtTime(d, tz)}`;
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

// A UTC Date as the "YYYY-MM-DDTHH:mm" a date-time field expects, in club time.
export function toZonedInput(d: Date, tz: string): string {
  const p = parts(d, tz);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
