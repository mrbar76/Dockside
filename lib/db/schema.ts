// Core data model. Rule: every table below `clubs` carries club_id, and a row
// rule in the database limits each request to one club (see withClub in ./index).
import { sql } from "drizzle-orm";
import {
  pgTable, pgPolicy, pgRole, uuid, text, timestamp, boolean, integer, jsonb, index, uniqueIndex, customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
import type { Theme, ClubSettings } from "../core/theme";

export const appRole = pgRole("dockside_app");

const currentClub = sql`nullif(current_setting('app.club_id', true), '')::uuid`;
const clubRule = () =>
  pgPolicy("club_isolation", {
    as: "permissive",
    for: "all",
    to: appRole,
    using: sql`club_id = ${currentClub}`,
    withCheck: sql`club_id = ${currentClub}`,
  });

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
// club_id fills itself from the request's club, so feature code never passes it.
const clubId = () =>
  uuid("club_id").notNull().default(currentClub).references(() => clubs.id, { onDelete: "cascade" });

export const clubs = pgTable("clubs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  tagline: text("tagline").notNull().default(""),
  about: text("about").notNull().default(""),
  timezone: text("timezone").notNull().default("America/New_York"),
  theme: jsonb("theme").$type<Theme>().notNull(),
  settings: jsonb("settings").$type<ClubSettings>().notNull(),
  createdAt: createdAt(),
});

export const households = pgTable("households", { id: id(), clubId: clubId(), name: text("name").notNull() }, () => [clubRule()]);

export const members = pgTable(
  "members",
  {
    id: id(),
    clubId: clubId(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
    email: text("email").notNull(), // lower case; two members of a household may share one
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phone: text("phone"),
    role: text("role").$type<"member" | "officer">().notNull().default("member"),
    title: text("title"), // officer title, e.g. Fleet Captain
    boatName: text("boat_name"),
    boatType: text("boat_type").$type<"power" | "sail">(),
    experience: text("experience").$type<"new" | "some" | "seasoned">().notNull().default("new"),
    inDirectory: boolean("in_directory").notNull().default(true),
    channel: text("channel").$type<"email" | "text" | "push" | "none">().notNull().default("email"),
    textConsentAt: timestamp("text_consent_at", { withTimezone: true }),
    linkToken: text("link_token").notNull(), // personal no-sign-in link
    feedToken: text("feed_token").notNull(), // calendar subscription
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    clubRule(),
    index("members_email_idx").on(t.clubId, t.email),
    uniqueIndex("members_link_token_idx").on(t.linkToken),
    uniqueIndex("members_feed_token_idx").on(t.feedToken),
  ],
);

export const groups = pgTable("groups", { id: id(), clubId: clubId(), name: text("name").notNull() }, () => [clubRule()]);

export const groupMembers = pgTable(
  "group_members",
  {
    id: id(),
    clubId: clubId(),
    groupId: uuid("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
  },
  (t) => [clubRule(), uniqueIndex("group_members_unique").on(t.groupId, t.memberId)],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    clubId: clubId(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    location: text("location").notNull().default(""),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    signup: boolean("signup").notNull().default(true),
    capacity: integer("capacity"),
    // Ticket prices in cents, e.g. [{ label: "Adult", cents: 4000 }, { label: "Child 12 and under", cents: 0 }]. Empty: free.
    prices: jsonb("prices").$type<{ label: string; cents: number }[]>().notNull().default([]),
    rsvpBy: timestamp("rsvp_by", { withTimezone: true }),
    membersOnly: boolean("members_only").notNull().default(false),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), index("events_starts_idx").on(t.clubId, t.startsAt)],
);

export const eventSignups = pgTable(
  "event_signups",
  {
    id: id(),
    clubId: clubId(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    partySize: integer("party_size").notNull().default(1),
    counts: jsonb("counts").$type<Record<string, number>>().notNull().default({}),
    amountCents: integer("amount_cents").notNull().default(0),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidHow: text("paid_how").$type<"card" | "bank" | "check" | "cash">(),
    note: text("note").notNull().default(""),
    enteredBy: uuid("entered_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), uniqueIndex("event_signups_unique").on(t.eventId, t.memberId)],
);

export const notices = pgTable(
  "notices",
  {
    id: id(),
    clubId: clubId(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    urgent: boolean("urgent").notNull().default(false),
    groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }), // null = all members
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => members.id, { onDelete: "set null" }),
  },
  (t) => [clubRule(), index("notices_published_idx").on(t.clubId, t.publishedAt)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: id(),
    clubId: clubId(),
    kind: text("kind").$type<"notice" | "weekly" | "signin" | "ride" | "event" | "application">().notNull(),
    noticeId: uuid("notice_id").references(() => notices.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").$type<"sent" | "logged" | "failed" | "skipped">().notNull(),
    detail: text("detail").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), index("deliveries_created_idx").on(t.clubId, t.createdAt)],
);

export const alertSubscriptions = pgTable(
  "alert_subscriptions",
  {
    id: id(),
    clubId: clubId(),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), uniqueIndex("alert_subscriptions_endpoint").on(t.endpoint)],
);

export const rideOffers = pgTable(
  "ride_offers",
  {
    id: id(),
    clubId: clubId(),
    ownerId: uuid("owner_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"crew" | "ride">().notNull(),
    title: text("title").notNull(),
    departsAt: timestamp("departs_at", { withTimezone: true }).notNull(),
    seats: integer("seats").notNull().default(1),
    experience: text("experience").$type<"any" | "some" | "seasoned">().notNull().default("any"),
    notes: text("notes").notNull().default(""),
    status: text("status").$type<"open" | "cancelled">().notNull().default("open"),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), index("ride_offers_departs_idx").on(t.clubId, t.departsAt)],
);

export const rideRequests = pgTable(
  "ride_requests",
  {
    id: id(),
    clubId: clubId(),
    offerId: uuid("offer_id").notNull().references(() => rideOffers.id, { onDelete: "cascade" }),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    note: text("note").notNull().default(""),
    status: text("status").$type<"pending" | "accepted" | "declined">().notNull().default("pending"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), uniqueIndex("ride_requests_unique").on(t.offerId, t.memberId)],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    clubId: clubId(),
    title: text("title").notNull(),
    category: text("category").notNull().default("General"),
    url: text("url").notNull(),
    membersOnly: boolean("members_only").notNull().default(true),
    createdAt: createdAt(),
  },
  () => [clubRule()],
);

// Uploaded files (documents, the home page photo). Kept in the database: a
// club's files are few and small, and backups then cover them too.
export const files = pgTable(
  "files",
  {
    id: id(),
    clubId: clubId(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    membersOnly: boolean("members_only").notNull().default(true),
    // Proofs of residency and similar: officers only, deleted once decided.
    officersOnly: boolean("officers_only").notNull().default(false),
    uploadedBy: uuid("uploaded_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  () => [clubRule()],
);

// A membership application, filled in online. Mirrors the club's paper form:
// sponsor, committees, residency, fees by check, then three sign-offs
// (membership committee, board, full membership vote).
export const applications = pgTable(
  "applications",
  {
    id: id(),
    clubId: clubId(),
    status: text("status").$type<"open" | "approved" | "declined" | "withdrawn">().notNull().default("open"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    zip: text("zip").notNull().default(""),
    occupation: text("occupation").notNull().default(""),
    businessPhone: text("business_phone").notNull().default(""),
    spouseName: text("spouse_name").notNull().default(""),
    children: text("children").notNull().default(""),
    boatName: text("boat_name").notNull().default(""),
    boatType: text("boat_type").notNull().default(""),
    boatLength: text("boat_length").notNull().default(""),
    boatBeam: text("boat_beam").notNull().default(""),
    sponsorName: text("sponsor_name").notNull().default(""),
    sponsorPhone: text("sponsor_phone").notNull().default(""),
    sponsorEmail: text("sponsor_email").notNull().default(""),
    sponsorId: uuid("sponsor_id").references(() => members.id, { onDelete: "set null" }),
    sponsoredAt: timestamp("sponsored_at", { withTimezone: true }),
    sponsorHow: text("sponsor_how").notNull().default(""),
    interests: jsonb("interests").$type<string[]>().notNull().default([]),
    interestsOther: text("interests_other").notNull().default(""),
    residencyCertified: boolean("residency_certified").notNull().default(false),
    proofIds: jsonb("proof_ids").$type<string[]>().notNull().default([]),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentNote: text("payment_note").notNull().default(""),
    committeeAt: timestamp("committee_at", { withTimezone: true }),
    boardAt: timestamp("board_at", { withTimezone: true }),
    voteAt: timestamp("vote_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note").notNull().default(""),
    officerNotes: text("officer_notes").notNull().default(""),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    statusToken: text("status_token").notNull(),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), uniqueIndex("applications_token_idx").on(t.statusToken), index("applications_status_idx").on(t.clubId, t.status)],
);
export type Application = typeof applications.$inferSelect;

// Officer-edited public pages: about, join, contact, privacy.
export const clubPages = pgTable(
  "club_pages",
  {
    id: id(),
    clubId: clubId(),
    key: text("key").$type<"about" | "join" | "contact" | "privacy" | "home">().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    photoId: uuid("photo_id").references(() => files.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => members.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [clubRule(), uniqueIndex("club_pages_key").on(t.clubId, t.key)],
);

// Who did what, including officers acting for a member.
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    clubId: clubId(),
    actorId: uuid("actor_id").references(() => members.id, { onDelete: "set null" }),
    onBehalfOf: uuid("on_behalf_of").references(() => members.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  () => [clubRule()],
);

export type Club = typeof clubs.$inferSelect;
export type Member = typeof members.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type Notice = typeof notices.$inferSelect;
export type RideOffer = typeof rideOffers.$inferSelect;
export type ClubPage = typeof clubPages.$inferSelect;

// Yearly dues, one bill per household (or per member with no household).
export const dues = pgTable(
  "dues",
  {
    id: id(),
    clubId: clubId(),
    year: integer("year").notNull(),
    memberId: uuid("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    amountCents: integer("amount_cents").notNull(),
    dueOn: timestamp("due_on", { withTimezone: true }).notNull(),
    lateFeePct: integer("late_fee_pct").notNull().default(0),
    lapseOn: timestamp("lapse_on", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidCents: integer("paid_cents"),
    paidHow: text("paid_how").$type<"card" | "bank" | "check" | "cash">(),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), uniqueIndex("dues_year_member").on(t.clubId, t.year, t.memberId)],
);
export type Dues = typeof dues.$inferSelect;

// Every payment, whatever it was for. In demo mode card and bank payments are
// pretend and marked demo; nothing reaches a payment processor.
export const payments = pgTable(
  "payments",
  {
    id: id(),
    clubId: clubId(),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    kind: text("kind").$type<"event" | "dues">().notNull(),
    refId: uuid("ref_id").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    feeCents: integer("fee_cents").notNull().default(0),
    method: text("method").$type<"card" | "bank" | "check" | "cash">().notNull(),
    demo: boolean("demo").notNull().default(false),
    note: text("note").notNull().default(""),
    recordedBy: uuid("recorded_by").references(() => members.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [clubRule(), index("payments_created_idx").on(t.clubId, t.createdAt)],
);
export type Payment = typeof payments.$inferSelect;
