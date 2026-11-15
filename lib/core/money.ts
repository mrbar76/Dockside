// Money helpers. Amounts are whole cents. Card and bank fee figures are Stripe's
// standard US rates (2.9% + 30c card, 0.8% capped at $5 bank), shown to
// officers only: the club absorbs them, because Connecticut bans card surcharges.
import type { Dues } from "../db/schema";

export const fmtCents = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const parseDollars = (s: string) => { const n = Number(String(s).replace(/[$,\s]/g, "")); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null; };

export function processorFee(cents: number, method: string) {
  if (method === "card") return Math.round(cents * 0.029) + 30;
  if (method === "bank") return Math.min(500, Math.round(cents * 0.008));
  return 0;
}

export type Tier = { label: string; cents: number };

// Total for a sign-up: counts per tier label times that tier's price.
export function ticketTotal(prices: Tier[], counts: Record<string, number>) {
  return prices.reduce((sum, t) => sum + t.cents * Math.max(0, Math.floor(counts[t.label] ?? 0)), 0);
}
export const headcount = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + Math.max(0, Math.floor(b || 0)), 0);

// What a dues bill costs today, with the late fee once the due date passes.
export function duesNow(d: Dues, now = new Date()) {
  if (d.paidAt) return { owed: 0, late: false, lapsed: false, status: "paid" as const };
  const late = now > d.dueOn;
  const lapsed = !!d.lapseOn && now > d.lapseOn;
  const owed = late ? Math.round(d.amountCents * (1 + d.lateFeePct / 100)) : d.amountCents;
  return { owed, late, lapsed, status: lapsed ? ("lapsed" as const) : late ? ("late" as const) : ("due" as const) };
}

// Reads up to three "tier label + price" rows from an officer's event form.
export function tiersFrom(f: FormData): Tier[] {
  const out: Tier[] = [];
  for (let i = 0; i < 3; i++) {
    const label = String(f.get(`tierLabel${i}`) ?? "").trim().slice(0, 40);
    const raw = String(f.get(`tierPrice${i}`) ?? "").trim();
    if (!label || raw === "") continue;
    const cents = parseDollars(raw);
    if (cents == null) throw new Error(`"${raw}" is not a price.`);
    out.push({ label, cents });
  }
  return out.every((t) => t.cents === 0) ? [] : out;
}
