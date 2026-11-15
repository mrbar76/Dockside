import { afterAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, pool, withClub } from "../lib/db";
import { auditLog, clubs, deliveries, events, members, notices, rideRequests } from "../lib/db/schema";
import { decideRequest, noticesFor, openOffers, signUp, thisWeek } from "../lib/core/data";
import { sendNoticeNow, sendWeekly, textFor } from "../lib/core/deliver";
import { buildCalendar, fold } from "../lib/core/ics";
import { importRoster, parseCsv } from "../lib/core/roster";
import { heightAt } from "../lib/core/tides";
import { zonedToUtc } from "../lib/core/time";

const all = await db.select().from(clubs);
const A = all.find((c) => c.slug === "mrbyc")!;
const B = all.find((c) => c.slug === "harbor-point")!;
const inA = <T>(fn: Parameters<typeof withClub<T>>[1]) => withClub(A.id, fn);
const who = async (first: string) => (await inA((tx) => tx.select().from(members).where(eq(members.firstName, first))))[0];

afterAll(() => pool.end());

describe("club separation (the leak test)", () => {
  it("shows a club only its own rows", async () => {
    const rows = await inA((tx) => tx.select().from(members));
    expect(rows.length).toBe(10);
    expect(rows.every((r) => r.clubId === A.id)).toBe(true);
  });

  it("cannot read another club's row even by its exact id", async () => {
    const [theirs] = await withClub(B.id, (tx) => tx.select().from(members).limit(1));
    expect(await inA((tx) => tx.select().from(members).where(eq(members.id, theirs.id)))).toEqual([]);
  });

  it("cannot change or delete another club's rows", async () => {
    const before = await withClub(B.id, (tx) => tx.select().from(events));
    await inA((tx) => tx.update(events).set({ title: "hijacked" }).where(eq(events.clubId, B.id)));
    await inA((tx) => tx.delete(notices).where(eq(notices.clubId, B.id)));
    const after = await withClub(B.id, (tx) => tx.select().from(events));
    expect(after.map((e) => e.title)).toEqual(before.map((e) => e.title));
    expect((await withClub(B.id, (tx) => tx.select().from(notices))).length).toBeGreaterThan(0);
  });

  it("refuses to write a row stamped with another club", async () => {
    await expect(inA((tx) => tx.insert(notices).values({ clubId: B.id, title: "x", body: "y" }))).rejects.toThrow();
  });

  it("stamps new rows with the right club without being told", async () => {
    const [n] = await inA((tx) => tx.insert(notices).values({ title: "auto", body: "stamp" }).returning());
    expect(n.clubId).toBe(A.id);
  });

  it("returns nothing when no club is set", async () => {
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role dockside_app`);
      return tx.select().from(members);
    });
    expect(rows).toEqual([]);
  });

  it("keeps the app role out of the sign-in tables and unable to edit the club list", async () => {
    await expect(inA((tx) => tx.execute(sql`select * from "session"`))).rejects.toThrow();
    await expect(inA((tx) => tx.execute(sql`update clubs set name = 'x'`))).rejects.toThrow();
  });

  it("has the club rule switched on for every club table", async () => {
    const res = await db.execute(sql`
      select c.relname as name, c.relrowsecurity as rls,
        exists (select 1 from information_schema.columns k where k.table_schema = 'public' and k.table_name = c.relname and k.column_name = 'club_id') as has_club
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    const global = new Set(["clubs", "user", "session", "account", "verification"]);
    for (const t of res.rows as { name: string; rls: boolean; has_club: boolean }[]) {
      if (global.has(t.name)) continue;
      expect(t.rls, `${t.name} must have the club rule`).toBe(true);
      expect(t.has_club, `${t.name} must carry club_id`).toBe(true);
    }
  });
});

describe("this week", () => {
  it("public view carries events and club-wide news but no group notices", async () => {
    const w = await inA((tx) => thisWeek(tx, null, new Date()));
    expect(w.events.length).toBeGreaterThanOrEqual(3);
    expect(w.notices.some((n) => n.groupId)).toBe(false);
  });

  it("group notices reach the group and officers only", async () => {
    const since = new Date(Date.now() - 30 * 86400000);
    const title = "Float storage plan for the committee";
    const sees = async (first: string) => (await inA(async (tx) => noticesFor(tx, await who(first), since))).some((n) => n.title === title);
    expect(await sees("Tom")).toBe(true); // dock committee
    expect(await sees("Ada")).toBe(true); // officer
    expect(await sees("Priya")).toBe(false);
  });
});

describe("events", () => {
  it("holds the line on capacity", async () => {
    const priya = await who("Priya"), ada = await who("Ada");
    const [e] = await inA((tx) => tx.insert(events).values({ title: "Small boat", startsAt: new Date(Date.now() + 86400000), capacity: 2 }).returning());
    await inA((tx) => signUp(tx, { eventId: e.id, memberId: priya.id, partySize: 2, note: "", enteredBy: priya.id }));
    await expect(inA((tx) => signUp(tx, { eventId: e.id, memberId: ada.id, partySize: 1, note: "", enteredBy: ada.id }))).rejects.toThrow(/places/);
    await inA((tx) => signUp(tx, { eventId: e.id, memberId: priya.id, partySize: 1, note: "", enteredBy: priya.id })); // shrinking is fine
  });

  it("logs an officer acting for a member", async () => {
    const nora = await who("Nora"), ada = await who("Ada");
    const [e] = await inA((tx) => tx.insert(events).values({ title: "Phone-in", startsAt: new Date(Date.now() + 86400000) }).returning());
    await inA((tx) => signUp(tx, { eventId: e.id, memberId: nora.id, partySize: 1, note: "", enteredBy: ada.id }));
    const log = await inA((tx) => tx.select().from(auditLog).where(eq(auditLog.onBehalfOf, nora.id)));
    expect(log.some((l) => l.actorId === ada.id && l.action === "event.signup")).toBe(true);
  });
});

describe("crew and ride board", () => {
  it("lets only the owner decide, and never past the seat count", async () => {
    const offers = await inA((tx) => openOffers(tx, new Date()));
    const delivery = offers.find((o) => o.offer.title === "Delivery to the winter yard")!; // 1 seat, owner Marcus
    const gwen = await who("Gwen"), nora = await who("Nora"), tom = await who("Tom");
    const [r1, r2] = await inA((tx) => tx.insert(rideRequests).values([
      { offerId: delivery.offer.id, memberId: gwen.id }, { offerId: delivery.offer.id, memberId: nora.id },
    ]).returning());
    await expect(inA((tx) => decideRequest(tx, r1.id, tom.id, true))).rejects.toThrow(/owner/);
    await inA((tx) => decideRequest(tx, r1.id, delivery.owner.id, true));
    await expect(inA((tx) => decideRequest(tx, r2.id, delivery.owner.id, true))).rejects.toThrow(/seat/);
    const again = (await inA((tx) => openOffers(tx, new Date()))).find((o) => o.offer.id === delivery.offer.id)!;
    expect(again.seatsLeft).toBe(0);
  });
});

describe("post once", () => {
  it("sends an urgent notice to every member by their own channel", async () => {
    const ada = await who("Ada");
    const [n] = await inA((tx) => tx.insert(notices).values({ title: "Test alert", body: "Body", urgent: true, createdBy: ada.id }).returning());
    const reached = await inA((tx) => sendNoticeNow(tx, A, n.id, "https://club.example"));
    const log = await inA((tx) => tx.select({ d: deliveries, m: members }).from(deliveries).innerJoin(members, eq(members.id, deliveries.memberId)).where(eq(deliveries.noticeId, n.id)));
    expect(log.length).toBe(reached);
    const by = (first: string) => log.find((l) => l.m.firstName === first)!.d;
    expect(by("Tom").channel).toBe("text"); // consented to texts
    expect(by("Tom").detail).toContain("https://club.example/mrbyc/w/");
    expect(by("Elena").channel).toBe("email"); // chose alerts, no phone registered yet: falls back
    expect(by("Marcus").status).toBe("skipped"); // chose nothing sent
    expect(by("Ada").status).toBe("logged"); // demo mode never really sends
  });

  it("a group notice goes to the group only", async () => {
    const g = (await inA((tx) => tx.execute(sql`select id from groups where name = 'Dock committee'`))).rows[0] as { id: string };
    const [n] = await inA((tx) => tx.insert(notices).values({ title: "Committee only", body: "x", urgent: true, groupId: g.id }).returning());
    expect(await inA((tx) => sendNoticeNow(tx, A, n.id, "https://club.example"))).toBe(2);
  });

  it("prepares one weekly message per member", async () => {
    const n = await inA((tx) => sendWeekly(tx, A, "https://club.example"));
    expect(n).toBeGreaterThanOrEqual(10);
  });

  it("keeps a text to one 160-character segment, link intact", () => {
    const url = "https://club.example/mrbyc/w/abcdefghijklmnopqrstuvwx";
    const t = textFor({ shortName: "MRBYC" }, { subject: "A very long headline ".repeat(12), body: "", url });
    expect(t.length).toBeLessThanOrEqual(160);
    expect(t.endsWith(url)).toBe(true);
  });
});

describe("calendar feed, roster, time, tides", () => {
  it("builds a feed phones accept: folded lines, one entry per event", async () => {
    const list = await inA((tx) => tx.select().from(events));
    const ics = buildCalendar(A, list, "https://club.example");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)!.length).toBe(list.length);
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(fold("x".repeat(200)).split("\r\n ").join("")).toBe("x".repeat(200));
  });

  it("reads a spreadsheet export with quotes and commas", () => {
    expect(parseCsv('a,b\r\n"Smith, Jr.","say ""hi"""\n')).toEqual([["a", "b"], ["Smith, Jr.", 'say "hi"']]);
  });

  it("imports a roster without doubling people", async () => {
    const csv = "First Name,Last Name,Email,Phone,Boat,Boat Type\nRosa,Quill,rosa@example.com,,Heron,Sail\nNo,Email,,,,";
    const first = await inA((tx) => importRoster(tx, csv));
    const second = await inA((tx) => importRoster(tx, csv));
    expect(first).toMatchObject({ added: 1, updated: 0 });
    expect(first.skipped.length).toBe(1);
    expect(second).toMatchObject({ added: 0, updated: 1 });
  });

  it("turns club local time into the right instant, winter and summer", () => {
    expect(zonedToUtc("2026-11-20T18:30", "America/New_York").toISOString()).toBe("2026-11-20T23:30:00.000Z");
    expect(zonedToUtc("2027-07-04T09:00", "America/New_York").toISOString()).toBe("2027-07-04T13:00:00.000Z");
  });

  it("draws the tide between two turning points", () => {
    const tides = [{ at: new Date("2026-01-01T00:00Z"), ft: 0, high: false }, { at: new Date("2026-01-01T06:00Z"), ft: 6, high: true }];
    expect(heightAt(tides, new Date("2026-01-01T03:00Z"))).toBeCloseTo(3);
    expect(heightAt(tides, new Date("2026-01-01T09:00Z"))).toBeNull();
  });
});

describe("v1 gaps: files, pages, export, wind", async () => {
  const { files, clubPages } = await import("../lib/db/schema");
  const { rowsOf, toCsv } = await import("../lib/core/export");
  const { toKnots } = await import("../lib/core/wind");
  const { toZonedInput } = await import("../lib/core/time");
  const { clubPage } = await import("../lib/core/data");

  it("keeps uploaded files and club pages inside their own club", async () => {
    const [f] = await inA((tx) => tx.insert(files).values({ name: "t.txt", type: "text/plain", size: 2, data: Buffer.from("hi"), membersOnly: true }).returning());
    await inA((tx) => tx.insert(clubPages).values({ key: "about", title: "About us", body: "Hello" }));
    expect(await withClub(B.id, (tx) => tx.select().from(files).where(eq(files.id, f.id)))).toEqual([]);
    expect(await withClub(B.id, (tx) => tx.select().from(clubPages).where(eq(clubPages.key, "about")))).toEqual([]);
    const page = await inA((tx) => clubPage(tx, A, "about"));
    expect(page.title).toBe("About us");
    expect(page.isDefault).toBe(false);
    await inA(async (tx) => { await tx.delete(files).where(eq(files.id, f.id)); await tx.delete(clubPages).where(eq(clubPages.key, "about")); });
  });

  it("gives every club a privacy draft until the Board writes its own", async () => {
    const p = await withClub(B.id, (tx) => clubPage(tx, B, "privacy"));
    expect(p.isDefault).toBe(true);
    expect(p.body).toMatch(/STOP/);
  });

  it("exports the club's data without sign-in links, phone keys or file contents", async () => {
    const people = (await inA((tx) => rowsOf(tx, "members")))!;
    expect(people.length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(people[0])).not.toContain("linkToken");
    expect(Object.keys(people[0])).not.toContain("feedToken");
    const fl = (await inA((tx) => rowsOf(tx, "files")))!;
    expect(fl.every((r) => !("data" in r))).toBe(true);
    expect(await inA((tx) => rowsOf(tx, "nope"))).toBeNull();
  });

  it("writes spreadsheet cells that cannot run as formulas", () => {
    const csv = toCsv([{ a: "=HYPERLINK(1)", b: 'say "hi", ok', c: null, d: new Date("2026-01-01T00:00:00Z") }]);
    expect(csv).toBe(`a,b,c,d\r\n"'=HYPERLINK(1)","say ""hi"", ok",,2026-01-01T00:00:00.000Z\r\n`);
  });

  it("reads NWS wind in knots", () => {
    expect(toKnots("10 mph")).toBe("9 kt");
    expect(toKnots("5 to 15 mph")).toBe("4 to 13 kt");
  });

  it("fills an edit form with the club's local time", () => {
    const d = zonedToUtc("2026-07-04T18:30", "America/New_York");
    expect(toZonedInput(d, "America/New_York")).toBe("2026-07-04T18:30");
  });
});

describe("membership applications", async () => {
  const { applications } = await import("../lib/db/schema");
  const { stageOf, membershipRules } = await import("../lib/core/applications");
  const base = { firstName: "Marco", lastName: "V", email: "m@example.com", statusToken: "tok-" + Math.random().toString(36).slice(2) };

  it("keeps applications inside their own club", async () => {
    const [a] = await inA((tx) => tx.insert(applications).values(base).returning());
    expect(await withClub(B.id, (tx) => tx.select().from(applications).where(eq(applications.id, a.id)))).toEqual([]);
    await inA((tx) => tx.delete(applications).where(eq(applications.id, a.id)));
  });

  it("tells an applicant what is missing and what comes next", () => {
    const a = { status: "open", sponsoredAt: null, paidAt: null, committeeAt: null, boardAt: null, voteAt: null } as never;
    expect(stageOf(a)).toBe("Waiting on your sponsor's sign-off and your check. Next: Membership Committee.");
    expect(stageOf({ ...(a as object), sponsoredAt: new Date(), paidAt: new Date(), committeeAt: new Date() } as never)).toBe("Next: Board of Governors.");
    expect(stageOf({ ...(a as object), status: "approved" } as never)).toMatch(/Welcome aboard/);
  });

  it("asks for proofs only where the club has a residency rule", () => {
    expect(membershipRules(B).proofsRequired).toBe(0);
    expect(membershipRules({ ...B, settings: { ...B.settings, residency: "Greenwich" } }).proofsRequired).toBe(2);
  });
});
