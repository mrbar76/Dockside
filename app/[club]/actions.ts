"use server";
// Every change a person can make goes through here. Each action works out who
// is asking, checks they may, and does the work inside the club's own scope.
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { withClub } from "@/lib/db";
import { alertSubscriptions, auditLog, deliveries, events, members, notices, rideOffers, rideRequests } from "@/lib/db/schema";
import { requireClub } from "@/lib/core/clubs";
import { getViewer, origin } from "@/lib/core/viewer";
import { cancelSignup, decideRequest, newToken, signUp } from "@/lib/core/data";
import { sendEmail, sendNoticeNow, sendWeekly } from "@/lib/core/deliver";
import { importRoster } from "@/lib/core/roster";
import { zonedToUtc } from "@/lib/core/time";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");
const to = (path: string, kind: "ok" | "error", text: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);
const safeNext = (slug: string, next: string) => (next.startsWith(`/${slug}/`) ? next : `/${slug}/this-week`);

async function member(slug: string) {
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  if (!viewer) redirect(`/${slug}/sign-in`);
  return { club, viewer, me: viewer.member };
}
async function officer(slug: string) {
  const ctx = await member(slug);
  if (!ctx.viewer.isOfficer) redirect(`/${slug}/this-week`);
  return ctx;
}

// Sign-in
export async function requestCode(slug: string, f: FormData) {
  const club = await requireClub(slug);
  const email = str(f, "email").toLowerCase();
  const next = str(f, "next");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) to(`/${slug}/sign-in`, "error", "Enter the email address the club has for you.");
  const onRoster = await withClub(club.id, (tx) =>
    tx.select({ id: members.id }).from(members).where(and(eq(members.email, email), eq(members.active, true))).limit(1));
  // Same answer whether or not the address is on the roster, so nobody can
  // use this form to find out who is a member.
  if (onRoster.length) {
    const code = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
    const link = `${await origin()}/${slug}/sign-in?email=${encodeURIComponent(email)}&code=${code}`;
    const out = await sendEmail(email, {
      subject: `${code} is your ${club.shortName} sign-in code`,
      body: `Type ${code} on the sign-in page, or open the link below and press Sign in. The code works for 10 minutes.`,
      url: link,
    }, club.name);
    await withClub(club.id, (tx) => tx.insert(deliveries).values({ kind: "signin", memberId: onRoster[0].id, channel: "email", status: out.status, detail: "sign-in code" }));
    if (process.env.DEMO_MODE === "true" && !process.env.SMTP_URL)
      (await cookies()).set("demo_code", code, { maxAge: 600, httpOnly: true, sameSite: "lax", path: "/" });
  }
  redirect(`/${slug}/sign-in?email=${encodeURIComponent(email)}&sent=1&next=${encodeURIComponent(next)}`);
}

export async function verifyCode(slug: string, f: FormData) {
  const email = str(f, "email").toLowerCase();
  const otp = str(f, "code").replace(/\D/g, "");
  const next = str(f, "next");
  try {
    await auth.api.signInEmailOTP({ body: { email, otp }, headers: await headers() });
  } catch {
    to(`/${slug}/sign-in?email=${encodeURIComponent(email)}&sent=1&next=${encodeURIComponent(next)}`, "error", "That code did not match or has run out. Check it, or ask for a new one.");
  }
  (await cookies()).delete("demo_code");
  redirect(safeNext(slug, next));
}

export async function signOut(slug: string) {
  await auth.api.signOut({ headers: await headers() });
  redirect(`/${slug}`);
}

export async function chooseProfile(slug: string, f: FormData) {
  const { club, viewer } = await member(slug);
  const id = str(f, "memberId");
  if (viewer.profiles.some((p) => p.id === id))
    (await cookies()).set(`profile_${club.id}`, id, { maxAge: 60 * 60 * 24 * 365, httpOnly: true, sameSite: "lax", path: "/" });
  redirect(`/${slug}/me`);
}

// Events
export async function signUpForEvent(slug: string, eventId: string, f: FormData) {
  const { club, viewer, me } = await member(slug);
  const path = `/${slug}/calendar/${eventId}`;
  const forId = str(f, "memberId");
  const memberId = viewer.isOfficer && forId ? forId : me.id; // only officers may act for someone else
  const partySize = Math.min(20, Math.max(1, Number(str(f, "partySize")) || 1));
  try {
    await withClub(club.id, (tx) => signUp(tx, { eventId, memberId, partySize, note: str(f, "note").slice(0, 200), enteredBy: me.id }));
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", memberId === me.id ? "You are signed up." : "Signed up on their behalf. This is logged under your name.");
}

export async function cancelMySignup(slug: string, eventId: string) {
  const { club, me } = await member(slug);
  await withClub(club.id, (tx) => cancelSignup(tx, eventId, me.id));
  to(`/${slug}/calendar/${eventId}`, "ok", "Your sign-up is cancelled.");
}

export async function postEvent(slug: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers`;
  const title = str(f, "title");
  try {
    if (!title) throw new Error("Give the event a name.");
    const startsAt = zonedToUtc(str(f, "startsAt"), club.timezone);
    const end = str(f, "endsAt");
    const cap = Number(str(f, "capacity"));
    await withClub(club.id, (tx) => tx.insert(events).values({
      title, startsAt, endsAt: end ? zonedToUtc(end, club.timezone) : null, location: str(f, "location"),
      description: str(f, "description"), signup: f.get("signup") === "on", capacity: cap > 0 ? cap : null, createdBy: me.id,
    }));
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", "Event added. It is on the calendar, the this-week page and every subscribed phone.");
}

// Notices: post once. Urgent goes out now; the rest waits for the weekly message.
export async function postNotice(slug: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers`;
  const title = str(f, "title"), body = str(f, "body"), groupId = str(f, "groupId") || null;
  const urgent = f.get("urgent") === "on";
  let reached = 0;
  try {
    if (!title || !body) throw new Error("A notice needs a headline and a message.");
    const base = await origin();
    reached = await withClub(club.id, async (tx) => {
      const [n] = await tx.insert(notices).values({ title, body, urgent, groupId, createdBy: me.id }).returning();
      return urgent ? sendNoticeNow(tx, club, n.id, base) : 0;
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", urgent ? `Posted and sent to ${reached} members by their chosen channel.` : "Posted. It is on the page now and goes in the next weekly message.");
}

export async function sendWeeklyNow(slug: string) {
  const { club } = await officer(slug);
  const base = await origin();
  const n = await withClub(club.id, (tx) => sendWeekly(tx, club, base));
  to(`/${slug}/officers`, "ok", `Weekly message prepared for ${n} members.`);
}

export async function importRosterAction(slug: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/roster`;
  let summary = "";
  try {
    const r = await withClub(club.id, async (tx) => {
      const out = await importRoster(tx, str(f, "csv"));
      await tx.insert(auditLog).values({ actorId: me.id, action: "roster.import", detail: { added: out.added, updated: out.updated, skipped: out.skipped.length } });
      return out;
    });
    summary = `${r.added} added, ${r.updated} updated${r.skipped.length ? `, ${r.skipped.length} skipped for a missing name or email` : ""}.`;
  } catch (e) { to(path, "error", msg(e)); }
  to(path, "ok", summary);
}

// Crew and ride board
export async function offerSeat(slug: string, f: FormData) {
  const { club, me } = await member(slug);
  const path = `/${slug}/rides`;
  try {
    const title = str(f, "title");
    if (!title) throw new Error("Say where you are going or what the trip is.");
    const kind = str(f, "kind") === "crew" ? "crew" : "ride";
    const exp = str(f, "experience");
    await withClub(club.id, (tx) => tx.insert(rideOffers).values({
      ownerId: me.id, kind, title, departsAt: zonedToUtc(str(f, "departsAt"), club.timezone),
      seats: Math.min(12, Math.max(1, Number(str(f, "seats")) || 1)),
      experience: exp === "some" || exp === "seasoned" ? exp : "any", notes: str(f, "notes").slice(0, 400),
    }));
  } catch (e) { to(path, "error", msg(e)); }
  to(path, "ok", "Your open seat is posted. You choose who comes aboard.");
}

export async function raiseHand(slug: string, offerId: string, f: FormData) {
  const { club, me } = await member(slug);
  await withClub(club.id, (tx) => tx.insert(rideRequests).values({ offerId, memberId: me.id, note: str(f, "note").slice(0, 200) }).onConflictDoNothing());
  to(`/${slug}/rides`, "ok", "Your hand is up. The owner decides and you will see it here.");
}

export async function decide(slug: string, requestId: string, accept: boolean) {
  const { club, me } = await member(slug);
  try { await withClub(club.id, (tx) => decideRequest(tx, requestId, me.id, accept)); }
  catch (e) { to(`/${slug}/rides`, "error", msg(e)); }
  to(`/${slug}/rides`, "ok", accept ? "Accepted. They can see it on the board." : "Declined.");
}

export async function withdrawOffer(slug: string, offerId: string) {
  const { club, me } = await member(slug);
  await withClub(club.id, (tx) => tx.update(rideOffers).set({ status: "cancelled" }).where(and(eq(rideOffers.id, offerId), eq(rideOffers.ownerId, me.id))));
  to(`/${slug}/rides`, "ok", "Your offer is withdrawn.");
}

// How I hear from the club
export async function saveChannel(slug: string, f: FormData) {
  const { club, me } = await member(slug);
  const path = `/${slug}/me`;
  const c = str(f, "channel");
  const channel = c === "text" || c === "push" || c === "none" ? c : "email";
  const phone = str(f, "phone");
  if (channel === "text" && (!/^\+?[\d\s().-]{10,}$/.test(phone) || f.get("consent") !== "on"))
    to(path, "error", "For texts, enter your mobile number and tick the box to agree.");
  await withClub(club.id, (tx) => tx.update(members).set({
    channel, phone: phone || me.phone,
    textConsentAt: channel === "text" ? (me.textConsentAt ?? new Date()) : null,
    inDirectory: f.get("inDirectory") === "on",
  }).where(eq(members.id, me.id)));
  to(path, "ok", "Saved.");
}

export async function resetLinks(slug: string) {
  const { club, me } = await member(slug);
  await withClub(club.id, (tx) => tx.update(members).set({ linkToken: newToken(), feedToken: newToken() }).where(eq(members.id, me.id)));
  to(`/${slug}/me`, "ok", "New links made. The old ones no longer work, so re-add the calendar on your phone.");
}

export async function forgetAlerts(slug: string) {
  const { club, me } = await member(slug);
  await withClub(club.id, (tx) => tx.delete(alertSubscriptions).where(eq(alertSubscriptions.memberId, me.id)));
  to(`/${slug}/me`, "ok", "Alerts are off on every phone you had registered.");
}
