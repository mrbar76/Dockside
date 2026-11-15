// MRBYC's real yearly calendar and a dues run, for the demo. Used by the seed
// and, once, by the deploy step on demo databases made before this existed.
import { readFileSync } from "node:fs";
import { and, asc, eq, ilike } from "drizzle-orm";
import { db } from "./index";
import * as s from "./schema";
import { zonedToUtc } from "../core/time";

type Ev = { title: string; start: string; end?: string; location: string; description: string; signup: boolean; capacity?: number; membersOnly?: boolean; rsvpBy?: string; prices?: { label: string; cents: number }[] };

export async function addMrbycYear(clubId: string, tz = "America/New_York") {
  const year = JSON.parse(readFileSync(new URL("../../db/demo/mrbyc-year.json", import.meta.url), "utf8")) as { events: Ev[] };
  const [officer] = await db.select().from(s.members).where(and(eq(s.members.clubId, clubId), eq(s.members.role, "officer"))).limit(1);
  const rows = await db.insert(s.events).values(year.events.map((e) => ({
    clubId, title: e.title, description: e.description, location: e.location, signup: e.signup,
    startsAt: zonedToUtc(e.start, tz), endsAt: e.end ? zonedToUtc(e.end, tz) : null, capacity: e.capacity ?? null,
    membersOnly: !!e.membersOnly, rsvpBy: e.rsvpBy ? zonedToUtc(`${e.rsvpBy}T23:59`, tz) : null, prices: e.prices ?? [], createdBy: officer?.id ?? null,
  }))).returning();

  // 2027 dues: one bill per household, due March 1, 20% late fee, lapse April 1.
  const people = await db.select().from(s.members).where(and(eq(s.members.clubId, clubId), eq(s.members.active, true))).orderBy(asc(s.members.createdAt));
  const seen = new Set<string>();
  const heads = people.filter((m) => { const k = m.householdId ?? m.id; if (seen.has(k)) return false; seen.add(k); return true; });
  const bills = await db.insert(s.dues).values(heads.map((m) => ({
    clubId, year: 2027, memberId: m.id, amountCents: 16500,
    dueOn: zonedToUtc("2027-03-01T23:59", tz), lateFeePct: 20, lapseOn: zonedToUtc("2027-04-01T23:59", tz),
  }))).onConflictDoNothing().returning();
  // A few households paid early by check, so the Treasurer's page has something in it.
  for (const b of bills.filter((_, i) => i % 3 === 2)) {
    await db.update(s.dues).set({ paidAt: new Date(), paidHow: "check", paidCents: b.amountCents }).where(eq(s.dues.id, b.id));
    await db.insert(s.payments).values({ clubId, memberId: b.memberId, kind: "dues", refId: b.id, description: "2027 dues", amountCents: b.amountCents, method: "check", note: "early", recordedBy: officer?.id ?? null });
  }
  // Early sign-ups for the Commodore's Brunch, one paid, one not.
  const brunch = rows.find((r) => r.title === "Commodore's Brunch");
  if (brunch) {
    for (const [i, m] of people.slice(2, 4).entries()) {
      const counts = { Adult: 2, "Child 12 and under": i };
      const [su] = await db.insert(s.eventSignups).values({ clubId, eventId: brunch.id, memberId: m.id, partySize: 2 + i, counts, amountCents: 8000, paidAt: i === 0 ? new Date() : null, paidHow: i === 0 ? "card" : null }).returning();
      if (i === 0) await db.insert(s.payments).values({ clubId, memberId: m.id, kind: "event", refId: su.id, description: "Commodore's Brunch", amountCents: 8000, feeCents: 262, method: "card", demo: true });
    }
  }
  return { events: rows.length, bills: bills.length };
}

export async function hasMrbycYear(clubId: string) {
  const r = await db.select({ id: s.events.id }).from(s.events).where(and(eq(s.events.clubId, clubId), ilike(s.events.title, "Commodore's Brunch"))).limit(1);
  return r.length > 0;
}
