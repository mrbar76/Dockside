// Demo data: two clubs with different looks on the same core. Every person,
// event and notice here is made up. Dates are set relative to today.
import { sql } from "drizzle-orm";
import { db, pool } from "./index";
import * as s from "./schema";
import type { Theme } from "../core/theme";

const chart: Theme = {
  skin: "chart",
  colors: {
    bg: "#FBFCFA", surface: "#FFFFFF", ink: "#12324A", muted: "#4E6878", line: "#9DB8C6",
    brand: "#12324A", onBrand: "#FBFCFA", accent: "#A62B66", onAccent: "#FFFFFF", wash: "#D5E6EE", wash2: "#EFE2B0",
  },
  fonts: { display: "'Libre Caslon Text', Georgia, serif", body: "'Atkinson Hyperlegible Next Variable', system-ui, sans-serif" },
  radius: "3px",
  burgee: ["#12324A", "#FBFCFA", "#A62B66"],
};

const signal: Theme = {
  skin: "signal",
  colors: {
    bg: "#FFFFFF", surface: "#FFFFFF", ink: "#000000", muted: "#3D3D3D", line: "#000000",
    brand: "#0057B8", onBrand: "#FFFFFF", accent: "#E4002B", onAccent: "#FFFFFF", wash: "#FFD100", wash2: "#F1F1F1",
  },
  fonts: { display: "'Archivo Variable', system-ui, sans-serif", body: "'Archivo Variable', system-ui, sans-serif" },
  radius: "0px",
  burgee: ["#FFD100", "#0057B8", "#E4002B"],
};

const at = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour + 5, minute, 0, 0); // demo clubs are on US Eastern time
  return d;
};
const ago = (days: number) => new Date(Date.now() - days * 86400000);

type P = { first: string; last: string; email?: string; role?: "officer"; title?: string; boat?: string; type?: "power" | "sail";
  exp?: "new" | "some" | "seasoned"; channel?: "email" | "text" | "push" | "none"; phone?: string; household?: string };

async function club(c: typeof s.clubs.$inferInsert, people: P[], build: (ctx: { clubId: string; m: Record<string, string>; g: Record<string, string> }) => Promise<void>) {
  const [row] = await db.insert(s.clubs).values(c).returning();
  const clubId = row.id;
  const households: Record<string, string> = {};
  const m: Record<string, string> = {};
  for (const p of people) {
    if (p.household && !households[p.household])
      households[p.household] = (await db.insert(s.households).values({ clubId, name: p.household }).returning())[0].id;
    const [mem] = await db.insert(s.members).values({
      clubId, firstName: p.first, lastName: p.last,
      email: p.email ?? `${p.first}.${p.last}@example.com`.toLowerCase(),
      role: p.role ?? "member", title: p.title, boatName: p.boat, boatType: p.type, experience: p.exp ?? "some",
      channel: p.channel ?? "email", phone: p.phone, textConsentAt: p.channel === "text" ? ago(30) : null,
      householdId: p.household ? households[p.household] : null,
      linkToken: `demo-${c.slug}-${p.first}`.toLowerCase(), feedToken: `demo-feed-${c.slug}-${p.first}`.toLowerCase(),
    }).returning();
    m[p.first] = mem.id;
  }
  const g: Record<string, string> = {};
  for (const name of ["Board", "Dock committee", "New members"]) g[name] = (await db.insert(s.groups).values({ clubId, name }).returning())[0].id;
  await build({ clubId, m, g });
}

async function main() {
  await db.execute(sql`truncate table clubs, "user", "session", "account", "verification" cascade`);

  await club(
    {
      slug: "mrbyc", name: "Mianus River Boat & Yacht Club", shortName: "MRBYC",
      tagline: "A working boat club on the Mianus River in Cos Cob.",
      about: "Members run this club themselves. They keep the docks, haul the boats and cook the chili. This page is a demonstration with made-up people and events.",
      theme: chart, settings: { place: "Cos Cob Harbor, Connecticut", noaaStation: "8469549", contactEmail: "hello@example.com", demo: true },
    },
    [
      { first: "Ada", last: "Brennan", role: "officer", title: "Fleet Captain", boat: "Petrel", type: "sail", exp: "seasoned" },
      { first: "Elena", last: "Soto", role: "officer", title: "Social Governor", exp: "some", channel: "push" },
      { first: "Tom", last: "Okafor", boat: "Second Wind", type: "power", exp: "seasoned", channel: "text", phone: "+12035550142" },
      { first: "June", last: "Hadley", email: "hadleys@example.com", household: "Hadley", boat: "Marigold", type: "sail", exp: "seasoned" },
      { first: "Walt", last: "Hadley", email: "hadleys@example.com", household: "Hadley", exp: "some" },
      { first: "Priya", last: "Raman", exp: "new" },
      { first: "Marcus", last: "Lind", boat: "Tern", type: "sail", exp: "some", channel: "none" },
      { first: "Gwen", last: "Abara", exp: "new", channel: "text", phone: "+12035550177" },
      { first: "Leo", last: "Castellano", boat: "Bluefin", type: "power", exp: "seasoned" },
      { first: "Nora", last: "Feld", exp: "some" },
    ],
    async ({ clubId, m, g }) => {
      await db.insert(s.groupMembers).values([
        { clubId, groupId: g["Board"], memberId: m.Ada }, { clubId, groupId: g["Board"], memberId: m.Elena },
        { clubId, groupId: g["Dock committee"], memberId: m.Tom }, { clubId, groupId: g["Dock committee"], memberId: m.Leo },
        { clubId, groupId: g["New members"], memberId: m.Priya }, { clubId, groupId: g["New members"], memberId: m.Gwen },
      ]);
      const ev = await db.insert(s.events).values([
        { clubId, title: "Dock work party", description: "Pulling the east finger floats before the freeze. Gloves and coffee provided. Counts toward work hours.", location: "East dock", startsAt: at(1, 9), endsAt: at(1, 12), capacity: 16, createdBy: m.Ada },
        { clubId, title: "Chili cook-off", description: "Bring a pot or bring a spoon. Judging at 6:30.", location: "Clubhouse", startsAt: at(2, 17, 30), endsAt: at(2, 20), createdBy: m.Elena },
        { clubId, title: "Board meeting", description: "Open to all members. Agenda on the documents page.", location: "Clubhouse, upstairs", startsAt: at(4, 19), signup: false, createdBy: m.Ada },
        { clubId, title: "Winter cover workshop", description: "Leo shows how he frames and ties a cover that survives February.", location: "Yard, by the travel lift", startsAt: at(6, 10), capacity: 12, createdBy: m.Ada },
        { clubId, title: "Holiday potluck", description: "Families welcome.", location: "Clubhouse", startsAt: at(22, 17), createdBy: m.Elena },
      ]).returning();
      await db.insert(s.eventSignups).values([
        { clubId, eventId: ev[0].id, memberId: m.Tom, partySize: 1, enteredBy: m.Tom },
        { clubId, eventId: ev[0].id, memberId: m.Leo, partySize: 2, enteredBy: m.Leo },
        { clubId, eventId: ev[1].id, memberId: m.June, partySize: 2, note: "Bringing the white bean one", enteredBy: m.June },
        { clubId, eventId: ev[1].id, memberId: m.Priya, partySize: 1, enteredBy: m.Priya },
        { clubId, eventId: ev[1].id, memberId: m.Nora, partySize: 3, enteredBy: m.Elena },
      ]);
      await db.insert(s.notices).values([
        { clubId, title: "East dock closed Saturday morning", body: "The east finger floats come out Saturday from 9 to noon. Use the west ramp. Boats on the east side should be moved by Friday night.", urgent: true, publishedAt: ago(0.2), createdBy: m.Ada },
        { clubId, title: "Water shuts off November 22", body: "Dock water goes off for the winter on the 22nd. Fill your tanks before then.", publishedAt: ago(2), createdBy: m.Ada },
        { clubId, title: "Cook-off needs two more judges", body: "No experience needed, only an appetite. Tell Elena.", publishedAt: ago(3), createdBy: m.Elena },
        { clubId, title: "Float storage plan for the committee", body: "Draft layout is in the documents page. Comments by Thursday.", groupId: g["Dock committee"], publishedAt: ago(1), createdBy: m.Ada },
      ]);
      const offers = await db.insert(s.rideOffers).values([
        { clubId, ownerId: m.June, kind: "crew", title: "Last sail before haul-out", departsAt: at(2, 11), seats: 2, experience: "any", notes: "Two hours out past the bridge and back. Dress warm. I'll show you the ropes." },
        { clubId, ownerId: m.Tom, kind: "ride", title: "Run to Greenwich Point and back", departsAt: at(3, 13), seats: 3, experience: "any", notes: "Easy afternoon ride. Kids welcome with a life jacket." },
        { clubId, ownerId: m.Marcus, kind: "crew", title: "Delivery to the winter yard", departsAt: at(8, 8), seats: 1, experience: "some", notes: "Need one steady hand for lines at the dock." },
      ]).returning();
      await db.insert(s.rideRequests).values([
        { clubId, offerId: offers[0].id, memberId: m.Priya, note: "Never sailed. Would love to learn.", status: "pending" },
        { clubId, offerId: offers[1].id, memberId: m.Nora, note: "Two of us if there's room.", status: "accepted", decidedAt: ago(1) },
      ]);
      await db.insert(s.documents).values([
        { clubId, title: "Membership application", category: "Join", url: "#", membersOnly: false },
        { clubId, title: "Bylaws", category: "Rules", url: "#" },
        { clubId, title: "Yard and dock rules", category: "Rules", url: "#" },
        { clubId, title: "November Board agenda", category: "Board", url: "#" },
        { clubId, title: "Winter float storage plan (draft)", category: "Dock committee", url: "#" },
      ]);
    },
  );

  await club(
    {
      slug: "harbor-point", name: "Harbor Point Sailing Club", shortName: "HPSC",
      tagline: "Small boats, short races, long lunches.",
      about: "Harbor Point is a made-up club. It exists to show a second look on the same core.",
      theme: signal, settings: { place: "Harbor Point, Long Island Sound", noaaStation: "8516945", contactEmail: "hello@example.com", demo: true },
    },
    [
      { first: "Rhea", last: "Lindqvist", role: "officer", title: "Commodore", boat: "Kestrel", type: "sail", exp: "seasoned" },
      { first: "Dev", last: "Arora", boat: "Sprite", type: "sail", exp: "seasoned" },
      { first: "Maya", last: "Okonjo", exp: "new" },
      { first: "Finn", last: "Rasmussen", exp: "some", channel: "push" },
      { first: "Cora", last: "Vance", boat: "Otter", type: "sail", exp: "some" },
      { first: "Abel", last: "Moreau", exp: "new", channel: "text", phone: "+15165550119" },
    ],
    async ({ clubId, m }) => {
      const ev = await db.insert(s.events).values([
        { clubId, title: "Frostbite series, race 3", description: "First gun at 11. Dry suits required.", location: "Committee boat", startsAt: at(1, 11), capacity: 24, createdBy: m.Rhea },
        { clubId, title: "Knots and chowder", description: "Six knots worth knowing, then lunch.", location: "Sail loft", startsAt: at(3, 12), createdBy: m.Rhea },
        { clubId, title: "Rules night", description: "Mark-room arguments settled with model boats.", location: "Sail loft", startsAt: at(5, 19), createdBy: m.Rhea },
      ]).returning();
      await db.insert(s.eventSignups).values([
        { clubId, eventId: ev[0].id, memberId: m.Dev, partySize: 1, enteredBy: m.Dev },
        { clubId, eventId: ev[0].id, memberId: m.Cora, partySize: 1, enteredBy: m.Cora },
      ]);
      await db.insert(s.notices).values([
        { clubId, title: "Launch ramp iced over, use the hoist", body: "The ramp is closed until it thaws. The hoist is open from 9.", urgent: true, publishedAt: ago(0.1), createdBy: m.Rhea },
        { clubId, title: "Spring racing calendar is posted", body: "Twelve Saturdays, starting April 17.", publishedAt: ago(4), createdBy: m.Rhea },
      ]);
      const offers = await db.insert(s.rideOffers).values([
        { clubId, ownerId: m.Dev, kind: "crew", title: "Crew wanted for race 3", departsAt: at(1, 10), seats: 1, experience: "some", notes: "Jib trim. I'll talk you through the starts." },
        { clubId, ownerId: m.Cora, kind: "crew", title: "Practice sail, first-timers welcome", departsAt: at(4, 13), seats: 2, experience: "any", notes: "Light air forecast." },
      ]).returning();
      await db.insert(s.rideRequests).values([{ clubId, offerId: offers[1].id, memberId: m.Maya, note: "First time on a dinghy.", status: "pending" }]);
      await db.insert(s.documents).values([
        { clubId, title: "Join the club", category: "Join", url: "#", membersOnly: false },
        { clubId, title: "Sailing instructions", category: "Racing", url: "#" },
      ]);
    },
  );
  console.log("seeded demo clubs: mrbyc, harbor-point");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
