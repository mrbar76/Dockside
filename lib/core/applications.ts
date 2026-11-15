// Membership applications: the club's paper form, online. Stages follow the
// paper form's sign-off line: Membership Committee, Board of Governors, Full
// Membership. Proofs of residency are officer-only and deleted once decided.
import { and, eq, ilike, inArray } from "drizzle-orm";
import type { Tx } from "../db";
import { applications, deliveries, files, members, type Application, type Club, type Member } from "../db/schema";
import { deliverTo, sendEmail, type Message } from "./deliver";

export const DEFAULT_COMMITTEES = ["Social", "Membership", "Work parties", "Racing", "Children's events", "Newsletter"];

export function membershipRules(club: Club) {
  const s = club.settings;
  return {
    fees: s.fees ?? null,
    committees: s.committees ?? DEFAULT_COMMITTEES,
    residency: s.residency ?? null,
    sponsorRequired: s.sponsorRequired ?? true,
    proofsRequired: s.residency ? (s.proofsRequired ?? 2) : 0,
    slipNote: s.slipNote ?? null,
  };
}

export const STEPS = [
  { key: "committeeAt", label: "Membership Committee" },
  { key: "boardAt", label: "Board of Governors" },
  { key: "voteAt", label: "Full Membership vote" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

// Where an application stands, in words an applicant understands.
export function stageOf(a: Application) {
  if (a.status === "approved") return "Welcome aboard. You are a member.";
  if (a.status === "declined") return "The club did not accept this application.";
  if (a.status === "withdrawn") return "You withdrew this application.";
  const next = STEPS.find((s) => !a[s.key]);
  const waiting = [!a.sponsoredAt && "your sponsor's sign-off", !a.paidAt && "your check"].filter(Boolean);
  return `${waiting.length ? `Waiting on ${waiting.join(" and ")}. ` : ""}Next: ${next?.label ?? "the full membership vote"}.`;
}

export const fmtMoney = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0 })}`;

// Who handles applications: officers titled for membership, else every officer.
export async function membershipOfficers(tx: Tx) {
  const named = await tx.select().from(members).where(and(eq(members.active, true), eq(members.role, "officer"), ilike(members.title, "%membership%")));
  return named.length ? named : tx.select().from(members).where(and(eq(members.active, true), eq(members.role, "officer")));
}

export async function tellOfficers(tx: Tx, club: Club, msg: Message) {
  for (const o of await membershipOfficers(tx)) await deliverTo(tx, club, o, msg, "application");
}

// The applicant is not a member yet, so email is the only channel.
export async function tellApplicant(tx: Tx, club: Club, a: Application, msg: Message) {
  const out = await sendEmail(a.email, msg, club.name);
  await tx.insert(deliveries).values({ kind: "application", channel: "email", status: out.status, detail: `To applicant ${a.firstName} ${a.lastName}: ${out.detail}` });
  return out;
}

export async function findSponsor(tx: Tx, email: string): Promise<Member | undefined> {
  if (!email) return undefined;
  const [m] = await tx.select().from(members).where(and(eq(members.active, true), ilike(members.email, email))).limit(1);
  return m;
}

// Once an application is decided, proofs of residency have done their job.
export async function dropProofs(tx: Tx, a: Application) {
  if (a.proofIds.length) await tx.delete(files).where(inArray(files.id, a.proofIds));
  await tx.update(applications).set({ proofIds: [] }).where(eq(applications.id, a.id));
}
