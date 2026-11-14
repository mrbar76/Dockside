// Post once, deliver by each member's chosen channel. Adapters switch on when
// their settings exist; otherwise the message is logged so a demo shows exactly
// what would have gone out.
import nodemailer, { type Transporter } from "nodemailer";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import type { Tx } from "../db";
import { alertSubscriptions, deliveries, groupMembers, members, notices, type Club, type Member } from "../db/schema";
import { eventsBetween, noticesFor, openOffers } from "./data";
import { fmtWhen } from "./time";

export type Message = { subject: string; body: string; url: string };
type Outcome = { status: "sent" | "logged" | "failed" | "skipped"; detail: string };

const demo = () => process.env.DEMO_MODE === "true";
let mailer: Transporter | null = null;

export async function sendEmail(to: string, msg: Message, fromName: string): Promise<Outcome> {
  if (!process.env.SMTP_URL) return { status: demo() ? "logged" : "skipped", detail: `email not configured; would send "${msg.subject}"` };
  try {
    mailer ??= nodemailer.createTransport(process.env.SMTP_URL);
    const from = (process.env.MAIL_FROM ?? "notices@example.com").replace(/^[^<]*</, `${fromName} <`);
    await mailer.sendMail({ from, to, subject: msg.subject, text: `${msg.body}\n\n${msg.url}` });
    return { status: "sent", detail: msg.subject };
  } catch (e) {
    return { status: "failed", detail: String(e).slice(0, 300) };
  }
}

// One segment only: 160 characters including the link. Longer texts bill double.
export function textFor(club: { shortName: string }, msg: Message): string {
  const tail = ` ${msg.url}`;
  const head = `${club.shortName}: ${msg.subject}`;
  const room = 160 - tail.length;
  return (head.length > room ? head.slice(0, room - 1).trimEnd() + "…" : head) + tail;
}

async function sendText(to: string, text: string): Promise<Outcome> {
  const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
  if (!sid || !token || !from) return { status: demo() ? "logged" : "skipped", detail: `texting not configured; would send: ${text}` };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, From: from, Body: text }),
    });
    return res.ok ? { status: "sent", detail: text } : { status: "failed", detail: `Twilio ${res.status}` };
  } catch (e) {
    return { status: "failed", detail: String(e).slice(0, 300) };
  }
}

async function sendAlert(tx: Tx, memberId: string, msg: Message): Promise<Outcome> {
  const subs = await tx.select().from(alertSubscriptions).where(eq(alertSubscriptions.memberId, memberId));
  if (subs.length === 0) return { status: "skipped", detail: "no phone icon registered for alerts" };
  const { VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv) return { status: demo() ? "logged" : "skipped", detail: `alerts not configured; would send "${msg.subject}"` };
  webpush.setVapidDetails(subject ?? "mailto:admin@example.com", pub, priv);
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: msg.subject, body: msg.body.slice(0, 140), url: msg.url }));
      ok++;
    } catch (e) {
      const gone = (e as { statusCode?: number }).statusCode;
      if (gone === 404 || gone === 410) await tx.delete(alertSubscriptions).where(eq(alertSubscriptions.id, s.id));
    }
  }
  return ok ? { status: "sent", detail: `${ok} device(s)` } : { status: "failed", detail: "no device accepted the alert" };
}

// Sends by the member's channel. Text needs recorded consent and a phone
// number; an alert with no device registered falls back to email.
export async function deliverTo(tx: Tx, club: Club, m: Member, msg: Message, kind: "notice" | "weekly", noticeId?: string) {
  let channel: string = m.channel;
  let out: Outcome;
  if (channel === "none") out = { status: "skipped", detail: "member chose calendar and dock sheet only" };
  else if (channel === "text" && m.phone && m.textConsentAt) out = await sendText(m.phone, textFor(club, msg));
  else if (channel === "push") {
    out = await sendAlert(tx, m.id, msg);
    if (out.status === "skipped") { channel = "email"; out = await sendEmail(m.email, msg, club.name); }
  } else { channel = "email"; out = await sendEmail(m.email, msg, club.name); }
  await tx.insert(deliveries).values({ kind, noticeId, memberId: m.id, channel, status: out.status, detail: out.detail });
  return out;
}

async function audience(tx: Tx, groupId: string | null) {
  if (!groupId) return tx.select().from(members).where(eq(members.active, true));
  const ids = (await tx.select({ id: groupMembers.memberId }).from(groupMembers).where(eq(groupMembers.groupId, groupId))).map((r) => r.id);
  return ids.length ? tx.select().from(members).where(and(eq(members.active, true), inArray(members.id, ids))) : [];
}

// Urgent notices go out right away. Others wait for the weekly message.
export async function sendNoticeNow(tx: Tx, club: Club, noticeId: string, origin: string) {
  const [notice] = await tx.select().from(notices).where(eq(notices.id, noticeId));
  if (!notice) throw new Error("Notice not found.");
  const people = await audience(tx, notice.groupId);
  for (const m of people)
    await deliverTo(tx, club, m, { subject: notice.title, body: notice.body, url: `${origin}/${club.slug}/w/${m.linkToken}` }, "notice", notice.id);
  return people.length;
}

// The weekly message: one short note per member, pointing at their own page.
export async function sendWeekly(tx: Tx, club: Club, origin: string, now = new Date()) {
  const people = await tx.select().from(members).where(eq(members.active, true));
  const weekEvents = await eventsBetween(tx, now, new Date(now.getTime() + 7 * 86400000));
  const rides = await openOffers(tx, now);
  let sent = 0;
  for (const m of people) {
    const news = await noticesFor(tx, m, new Date(now.getTime() - 7 * 86400000), 5);
    if (weekEvents.length + news.length + rides.length === 0) continue;
    const lines = [
      ...weekEvents.map((e) => `${fmtWhen(e.startsAt, club.timezone)}: ${e.title}`),
      ...news.map((n) => `News: ${n.title}`),
      ...(rides.length ? [`${rides.length} open seat${rides.length === 1 ? "" : "s"} on the crew and ride board`] : []),
    ];
    await deliverTo(tx, club, m, { subject: `This week at ${club.shortName}`, body: lines.join("\n"), url: `${origin}/${club.slug}/w/${m.linkToken}` }, "weekly");
    sent++;
  }
  return sent;
}
