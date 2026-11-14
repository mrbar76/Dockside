// Reads and writes for club data. Every function takes the scoped transaction
// from withClub, so none of them can reach another club.
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { Tx } from "../db";
import {
  auditLog, deliveries, documents, eventSignups, events, groupMembers, groups, members, notices,
  rideOffers, rideRequests, type Member,
} from "../db/schema";

export const newToken = () => randomBytes(18).toString("base64url");
export const fullName = (m: { firstName: string; lastName: string }) => `${m.firstName} ${m.lastName}`;

// Members
export const memberByLinkToken = async (tx: Tx, token: string) =>
  (await tx.select().from(members).where(and(eq(members.linkToken, token), eq(members.active, true))).limit(1))[0] ?? null;
export const memberByFeedToken = async (tx: Tx, token: string) =>
  (await tx.select().from(members).where(and(eq(members.feedToken, token), eq(members.active, true))).limit(1))[0] ?? null;
export const memberById = async (tx: Tx, id: string) =>
  (await tx.select().from(members).where(eq(members.id, id)).limit(1))[0] ?? null;
export const activeMembers = (tx: Tx) =>
  tx.select().from(members).where(eq(members.active, true)).orderBy(asc(members.lastName), asc(members.firstName));
export const directory = (tx: Tx) =>
  tx.select().from(members).where(and(eq(members.active, true), eq(members.inDirectory, true)))
    .orderBy(asc(members.lastName), asc(members.firstName));
export const memberGroupIds = async (tx: Tx, memberId: string) =>
  (await tx.select({ id: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.memberId, memberId))).map((r) => r.id);
export const listGroups = (tx: Tx) => tx.select().from(groups).orderBy(asc(groups.name));

// Events
export const eventsBetween = (tx: Tx, from: Date, to: Date) =>
  tx.select().from(events).where(and(gte(events.startsAt, from), lte(events.startsAt, to))).orderBy(asc(events.startsAt));
export const eventById = async (tx: Tx, id: string) =>
  (await tx.select().from(events).where(eq(events.id, id)).limit(1))[0] ?? null;
export const signupsFor = (tx: Tx, eventId: string) =>
  tx.select({ signup: eventSignups, member: members }).from(eventSignups)
    .innerJoin(members, eq(members.id, eventSignups.memberId))
    .where(eq(eventSignups.eventId, eventId)).orderBy(asc(eventSignups.createdAt));
export async function headcounts(tx: Tx, eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, number>();
  const rows = await tx.select({ eventId: eventSignups.eventId, n: sql<number>`coalesce(sum(${eventSignups.partySize}), 0)::int` })
    .from(eventSignups).where(inArray(eventSignups.eventId, eventIds)).groupBy(eventSignups.eventId);
  return new Map(rows.map((r) => [r.eventId, r.n]));
}
export async function mySignupEventIds(tx: Tx, memberId: string, eventIds: string[]) {
  if (eventIds.length === 0) return new Set<string>();
  const rows = await tx.select({ id: eventSignups.eventId }).from(eventSignups)
    .where(and(eq(eventSignups.memberId, memberId), inArray(eventSignups.eventId, eventIds)));
  return new Set(rows.map((r) => r.id));
}
export async function signUp(tx: Tx, a: { eventId: string; memberId: string; partySize: number; note: string; enteredBy: string }) {
  const event = await eventById(tx, a.eventId);
  if (!event || event.cancelledAt || !event.signup) throw new Error("Sign-up is closed for this event.");
  if (event.capacity != null) {
    const taken = (await headcounts(tx, [event.id])).get(event.id) ?? 0;
    const [mine] = await tx.select().from(eventSignups)
      .where(and(eq(eventSignups.eventId, event.id), eq(eventSignups.memberId, a.memberId)));
    if (taken - (mine?.partySize ?? 0) + a.partySize > event.capacity) throw new Error("Not enough places left for that many.");
  }
  await tx.insert(eventSignups).values({ ...a })
    .onConflictDoUpdate({ target: [eventSignups.eventId, eventSignups.memberId], set: { partySize: a.partySize, note: a.note, enteredBy: a.enteredBy } });
  if (a.enteredBy !== a.memberId)
    await tx.insert(auditLog).values({ actorId: a.enteredBy, onBehalfOf: a.memberId, action: "event.signup", detail: { eventId: a.eventId, partySize: a.partySize } });
}
export const cancelSignup = (tx: Tx, eventId: string, memberId: string) =>
  tx.delete(eventSignups).where(and(eq(eventSignups.eventId, eventId), eq(eventSignups.memberId, memberId)));

// Notices. A notice sent to a group is seen by that group and by officers.
export async function noticesFor(tx: Tx, viewer: Member | null, since: Date, limit = 20) {
  const mine = viewer ? await memberGroupIds(tx, viewer.id) : [];
  const visible =
    viewer?.role === "officer" ? undefined
    : mine.length ? or(isNull(notices.groupId), inArray(notices.groupId, mine))
    : isNull(notices.groupId);
  return tx.select().from(notices).where(and(gte(notices.publishedAt, since), visible))
    .orderBy(desc(notices.urgent), desc(notices.publishedAt)).limit(limit);
}

// Crew and ride board
export async function openOffers(tx: Tx, from: Date) {
  const offers = await tx.select({ offer: rideOffers, owner: members }).from(rideOffers)
    .innerJoin(members, eq(members.id, rideOffers.ownerId))
    .where(and(eq(rideOffers.status, "open"), gte(rideOffers.departsAt, from))).orderBy(asc(rideOffers.departsAt));
  const ids = offers.map((o) => o.offer.id);
  const reqs = ids.length
    ? await tx.select({ req: rideRequests, member: members }).from(rideRequests)
        .innerJoin(members, eq(members.id, rideRequests.memberId)).where(inArray(rideRequests.offerId, ids))
        .orderBy(asc(rideRequests.createdAt))
    : [];
  return offers.map((o) => {
    const requests = reqs.filter((r) => r.req.offerId === o.offer.id);
    const accepted = requests.filter((r) => r.req.status === "accepted").length;
    return { ...o, requests, seatsLeft: Math.max(0, o.offer.seats - accepted) };
  });
}
export type OfferView = Awaited<ReturnType<typeof openOffers>>[number];

// Only the owner of the offer decides who comes aboard.
export async function decideRequest(tx: Tx, requestId: string, ownerId: string, accept: boolean) {
  const [row] = await tx.select({ req: rideRequests, offer: rideOffers }).from(rideRequests)
    .innerJoin(rideOffers, eq(rideOffers.id, rideRequests.offerId)).where(eq(rideRequests.id, requestId));
  if (!row || row.offer.ownerId !== ownerId) throw new Error("Only the boat owner can decide this.");
  if (accept) {
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(rideRequests)
      .where(and(eq(rideRequests.offerId, row.offer.id), eq(rideRequests.status, "accepted")));
    if (n >= row.offer.seats && row.req.status !== "accepted") throw new Error("Every seat is already taken.");
  }
  await tx.update(rideRequests).set({ status: accept ? "accepted" : "declined", decidedAt: new Date() }).where(eq(rideRequests.id, requestId));
}

export const listDocuments = (tx: Tx, includeMembersOnly: boolean) =>
  tx.select().from(documents).where(includeMembersOnly ? undefined : eq(documents.membersOnly, false))
    .orderBy(asc(documents.category), asc(documents.title));

export const recentDeliveries = (tx: Tx, limit = 40) =>
  tx.select({ d: deliveries, member: members, notice: notices }).from(deliveries)
    .leftJoin(members, eq(members.id, deliveries.memberId)).leftJoin(notices, eq(notices.id, deliveries.noticeId))
    .orderBy(desc(deliveries.createdAt)).limit(limit);

// Everything the this-week page shows. With lowRisk set (personal link, dock QR
// code, printed sheet) no contact details leave the database.
export async function thisWeek(tx: Tx, viewer: Member | null, now: Date) {
  const until = new Date(now.getTime() + 7 * 86400000);
  const startOfWindow = new Date(now.getTime() - 3 * 3600000);
  const weekEvents = await eventsBetween(tx, startOfWindow, until);
  const ids = weekEvents.map((e) => e.id);
  // One query at a time: they share a single database transaction.
  const counts = await headcounts(tx, ids);
  const going = viewer ? await mySignupEventIds(tx, viewer.id, ids) : new Set<string>();
  const weekNotices = await noticesFor(tx, viewer, new Date(now.getTime() - 14 * 86400000), 6);
  const rides = await openOffers(tx, now);
  return { events: weekEvents, counts, going, notices: weekNotices, rides: rides.filter((r) => r.offer.departsAt <= new Date(now.getTime() + 14 * 86400000)) };
}
export type ThisWeek = Awaited<ReturnType<typeof thisWeek>>;
