// The club's own data, for the club to keep. Tokens, push keys and file
// contents are left out: they are secrets or are downloaded one by one.
import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { Tx } from "../db";
import {
  alertSubscriptions, auditLog, clubPages, deliveries, documents, eventSignups, events, files, groupMembers, groups,
  households, members, notices, rideOffers, rideRequests,
} from "../db/schema";

const SECRET = new Set(["linkToken", "feedToken", "data", "endpoint", "p256dh", "auth", "clubId"]);

export const TABLES: Record<string, { table: PgTable; label: string }> = {
  members: { table: members, label: "Members" },
  households: { table: households, label: "Households" },
  groups: { table: groups, label: "Groups" },
  "group-members": { table: groupMembers, label: "Who is in each group" },
  events: { table: events, label: "Events" },
  signups: { table: eventSignups, label: "Event sign-ups" },
  notices: { table: notices, label: "Notices" },
  deliveries: { table: deliveries, label: "Messages sent" },
  "ride-offers": { table: rideOffers, label: "Open seats posted" },
  "ride-requests": { table: rideRequests, label: "Hands raised" },
  documents: { table: documents, label: "Documents" },
  files: { table: files, label: "Uploaded files (names only)" },
  pages: { table: clubPages, label: "Club pages" },
  alerts: { table: alertSubscriptions, label: "Phone alert sign-ups (no keys)" },
  audit: { table: auditLog, label: "Change log" },
};

export async function rowsOf(tx: Tx, key: string) {
  const t = TABLES[key];
  if (!t) return null;
  const cols = Object.fromEntries(Object.entries(getTableColumns(t.table)).filter(([k]) => !SECRET.has(k)));
  return (await tx.select(cols).from(t.table)) as Record<string, unknown>[];
}

const cell = (v: unknown) => {
  if (v == null) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const head = Object.keys(rows[0]);
  return [head.join(","), ...rows.map((r) => head.map((h) => cell(r[h])).join(","))].join("\r\n") + "\r\n";
}
