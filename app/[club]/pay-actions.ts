"use server";
// Paying for tickets and dues. In this first pass, online payment is a demo:
// it records a pretend card or bank payment and moves no money. The live
// version hands the same step to Stripe, with the club as the merchant.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import { withClub, type Tx } from "@/lib/db";
import { auditLog, dues, eventSignups, events, members, payments, type Club } from "@/lib/db/schema";
import { requireClub } from "@/lib/core/clubs";
import { getViewer, origin } from "@/lib/core/viewer";
import { deliverTo } from "@/lib/core/deliver";
import { duesNow, fmtCents, processorFee } from "@/lib/core/money";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");
const to = (path: string, kind: "ok" | "error", text: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);
const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);
const demoPay = (club: Club) => process.env.DEMO_MODE === "true" && !!club.settings.demo;

async function signedIn(slug: string) {
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  if (!viewer) redirect(`/${slug}/sign-in`);
  return { club, viewer, me: viewer.member };
}

// What is being paid for, checked against who is paying.
export async function bill(tx: Tx, kind: string, id: string, memberId: string, isOfficer: boolean) {
  if (!isUuid(id)) return null;
  if (kind === "event") {
    const [row] = await tx.select({ s: eventSignups, e: events }).from(eventSignups).innerJoin(events, eq(events.id, eventSignups.eventId))
      .where(and(eq(eventSignups.eventId, id), eq(eventSignups.memberId, memberId)));
    if (!row) return null;
    return { kind: "event" as const, refId: row.s.id, title: row.e.title, cents: row.s.amountCents, paidAt: row.s.paidAt, back: `calendar/${id}`, counts: row.s.counts };
  }
  if (kind === "dues") {
    const [d] = await tx.select().from(dues).where(eq(dues.id, id));
    if (!d) return null;
    if (d.memberId !== memberId && !isOfficer) {
      const [me] = await tx.select().from(members).where(eq(members.id, memberId));
      const [payer] = await tx.select().from(members).where(eq(members.id, d.memberId));
      if (!me?.householdId || me.householdId !== payer?.householdId) return null;
    }
    const now = duesNow(d);
    return { kind: "dues" as const, refId: d.id, title: `${d.year} dues`, cents: now.owed, paidAt: d.paidAt, back: "me", late: now.late, counts: {} };
  }
  return null;
}

async function markPaid(tx: Tx, kind: "event" | "dues", refId: string, cents: number, method: "card" | "bank" | "check" | "cash") {
  if (kind === "event") await tx.update(eventSignups).set({ paidAt: new Date(), paidHow: method }).where(eq(eventSignups.id, refId));
  else await tx.update(dues).set({ paidAt: new Date(), paidHow: method, paidCents: cents }).where(eq(dues.id, refId));
}

export async function payOnline(slug: string, kind: string, id: string, f: FormData) {
  const { club, viewer, me } = await signedIn(slug);
  const path = `/${slug}/pay/${kind}/${id}`;
  const method = str(f, "method") === "bank" ? "bank" : "card";
  let done = "";
  try {
    if (!demoPay(club)) throw new Error("Online payment is not switched on yet. Please pay by check.");
    await withClub(club.id, async (tx) => {
      const b = await bill(tx, kind, id, me.id, viewer.isOfficer);
      if (!b) throw new Error("Nothing to pay here.");
      if (b.paidAt) throw new Error("This is already paid.");
      if (b.cents <= 0) throw new Error("Nothing is owed.");
      await markPaid(tx, b.kind, b.refId, b.cents, method);
      await tx.insert(payments).values({ memberId: me.id, kind: b.kind, refId: b.refId, description: b.title, amountCents: b.cents, feeCents: processorFee(b.cents, method), method, demo: true });
      done = `Paid ${fmtCents(b.cents)} for ${b.title}. A receipt would be emailed to you.`;
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", done);
}

// ---------- officers ----------

async function officer(slug: string) {
  const ctx = await signedIn(slug);
  if (!ctx.viewer.isOfficer) redirect(`/${slug}/this-week`);
  return ctx;
}

// A check or cash handed to the Treasurer.
export async function recordPayment(slug: string, kind: "event" | "dues", refId: string, back: string, f: FormData) {
  const { club, me } = await officer(slug);
  const method = str(f, "method") === "cash" ? "cash" : "check";
  const note = str(f, "note", 100);
  try {
    await withClub(club.id, async (tx) => {
      let cents = 0, who: string | null = null, title = "";
      if (kind === "event") {
        const [r] = await tx.select({ s: eventSignups, e: events }).from(eventSignups).innerJoin(events, eq(events.id, eventSignups.eventId)).where(eq(eventSignups.id, refId));
        if (!r || r.s.paidAt) throw new Error("Already paid, or not found.");
        cents = r.s.amountCents; who = r.s.memberId; title = r.e.title;
      } else {
        const [d] = await tx.select().from(dues).where(eq(dues.id, refId));
        if (!d || d.paidAt) throw new Error("Already paid, or not found.");
        cents = duesNow(d).owed; who = d.memberId; title = `${d.year} dues`;
      }
      await markPaid(tx, kind, refId, cents, method);
      await tx.insert(payments).values({ memberId: who, kind, refId, description: title, amountCents: cents, method, note, recordedBy: me.id });
      await tx.insert(auditLog).values({ actorId: me.id, onBehalfOf: who, action: "payment.record", detail: { kind, refId, cents, method } });
    });
  } catch (e) { to(`/${slug}/${back}`, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(`/${slug}/${back}`, "ok", `${method === "cash" ? "Cash" : "Check"} recorded.`);
}

// One bill per household, or per member with no household, at this year's rate.
export async function billDues(slug: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/money`;
  const year = Number(str(f, "year")) || new Date().getFullYear() + 1;
  const rule = club.settings.duesRule ?? { dueMonthDay: "03-01", lateFeePct: 0 };
  const amount = Math.round((club.settings.fees?.dues ?? 0) * 100);
  let made = 0;
  try {
    if (!amount) throw new Error("Set the yearly dues amount first.");
    const at = (md?: string) => (md ? new Date(`${year}-${md}T23:59:00-05:00`) : null);
    await withClub(club.id, async (tx) => {
      const people = await tx.select().from(members).where(eq(members.active, true)).orderBy(asc(members.createdAt));
      const seen = new Set<string>();
      for (const m of people) {
        const key = m.householdId ?? m.id;
        if (seen.has(key)) continue;
        seen.add(key);
        const r = await tx.insert(dues).values({ year, memberId: m.id, amountCents: amount, dueOn: at(rule.dueMonthDay)!, lateFeePct: rule.lateFeePct, lapseOn: at(rule.lapseMonthDay) })
          .onConflictDoNothing().returning({ id: dues.id });
        made += r.length;
      }
      await tx.insert(auditLog).values({ actorId: me.id, action: "dues.bill", detail: { year, made } });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(path);
  to(path, "ok", made ? `${made} bills made for ${year}. Members see them on their Me page.` : `Everyone already has a ${year} bill.`);
}

export async function remindDues(slug: string, year: number) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/money`;
  const base = await origin();
  const n = await withClub(club.id, async (tx) => {
    const rows = await tx.select({ d: dues, m: members }).from(dues).innerJoin(members, eq(members.id, dues.memberId)).where(and(eq(dues.year, year), isNull(dues.paidAt)));
    for (const { d, m } of rows) {
      const now = duesNow(d);
      await deliverTo(tx, club, m, {
        subject: `${club.shortName} ${year} dues: ${fmtCents(now.owed)}${now.late ? " (late fee applied)" : ""}`,
        body: `Your ${year} dues are ${now.late ? "past due" : `due by ${d.dueOn.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: club.timezone })}`}. Pay online, or mail a check to the Treasurer.`,
        url: `${base}/${slug}/pay/dues/${d.id}`,
      }, "notice");
      await tx.update(dues).set({ remindedAt: new Date() }).where(eq(dues.id, d.id));
    }
    await tx.insert(auditLog).values({ actorId: me.id, action: "dues.remind", detail: { year, n: rows.length } });
    return rows.length;
  });
  revalidatePath(path);
  to(path, "ok", `Reminder sent to ${n} household${n === 1 ? "" : "s"} that still owe.`);
}
