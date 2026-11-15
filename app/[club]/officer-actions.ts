"use server";
// Officer-only changes: fixing and cancelling what was posted, people and
// groups, documents and the club's own pages. Every action checks the person
// is an officer of this club and works inside the club's own scope.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { withClub } from "@/lib/db";
import {
  auditLog, clubPages, documents, eventSignups, events, files, groupMembers, groups, members, notices,
} from "@/lib/db/schema";
import { requireClub } from "@/lib/core/clubs";
import { getViewer, origin } from "@/lib/core/viewer";
import { newToken, officerCount } from "@/lib/core/data";
import { deliverTo } from "@/lib/core/deliver";
import { fmtWhen, zonedToUtc } from "@/lib/core/time";
import { tiersFrom } from "@/lib/core/money";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");
const to = (path: string, kind: "ok" | "error", text: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);
const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);

async function officer(slug: string) {
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  if (!viewer) redirect(`/${slug}/sign-in`);
  if (!viewer.isOfficer) redirect(`/${slug}/this-week`);
  return { club, me: viewer.member };
}

// Events
function eventFields(f: FormData, tz: string) {
  const title = str(f, "title");
  if (!title) throw new Error("Give the event a name.");
  const end = str(f, "endsAt");
  const cap = Number(str(f, "capacity"));
  return {
    title, startsAt: zonedToUtc(str(f, "startsAt"), tz), endsAt: end ? zonedToUtc(end, tz) : null,
    location: str(f, "location"), description: str(f, "description"), signup: f.get("signup") === "on",
    capacity: cap > 0 ? cap : null,
    prices: tiersFrom(f), rsvpBy: str(f, "rsvpBy") ? zonedToUtc(`${str(f, "rsvpBy")}T23:59`, tz) : null,
    membersOnly: f.get("membersOnly") === "on",
  };
}

export async function updateEvent(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/calendar/${id}`;
  try {
    const fields = eventFields(f, club.timezone);
    await withClub(club.id, async (tx) => {
      await tx.update(events).set(fields).where(eq(events.id, id));
      await tx.insert(auditLog).values({ actorId: me.id, action: "event.edit", detail: { eventId: id } });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", "Event saved. Calendars that subscribe pick up the change on their next refresh.");
}

export async function cancelEvent(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/calendar/${id}`;
  const tell = f.get("tell") === "on";
  const reason = str(f, "reason");
  const base = await origin();
  const told = await withClub(club.id, async (tx) => {
    const [ev] = await tx.update(events).set({ cancelledAt: new Date() }).where(eq(events.id, id)).returning();
    if (!ev) return 0;
    await tx.insert(auditLog).values({ actorId: me.id, action: "event.cancel", detail: { eventId: id, reason } });
    if (!tell) return 0;
    const ids = (await tx.select({ id: eventSignups.memberId }).from(eventSignups).where(eq(eventSignups.eventId, id))).map((r) => r.id);
    const people = ids.length ? await tx.select().from(members).where(inArray(members.id, ids)) : [];
    for (const m of people)
      await deliverTo(tx, club, m, {
        subject: `Cancelled: ${ev.title}, ${fmtWhen(ev.startsAt, club.timezone)}`,
        body: reason || "This event is cancelled.", url: `${base}/${slug}/calendar/${id}`,
      }, "event");
    return people.length;
  });
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", tell ? `Cancelled. ${told} member${told === 1 ? "" : "s"} who signed up were told.` : "Cancelled. Nobody was messaged.");
}

export async function restoreEvent(slug: string, id: string) {
  const { club, me } = await officer(slug);
  await withClub(club.id, async (tx) => {
    await tx.update(events).set({ cancelledAt: null }).where(eq(events.id, id));
    await tx.insert(auditLog).values({ actorId: me.id, action: "event.restore", detail: { eventId: id } });
  });
  revalidatePath(`/${slug}`, "layout");
  to(`/${slug}/calendar/${id}`, "ok", "The event is back on.");
}

// Notices
export async function updateNotice(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const title = str(f, "title"), body = str(f, "body");
  if (!title || !body) to(`/${slug}/news`, "error", "A notice needs a headline and a message.");
  await withClub(club.id, async (tx) => {
    await tx.update(notices).set({ title, body, urgent: f.get("urgent") === "on", groupId: str(f, "groupId") || null }).where(eq(notices.id, id));
    await tx.insert(auditLog).values({ actorId: me.id, action: "notice.edit", detail: { noticeId: id } });
  });
  revalidatePath(`/${slug}`, "layout");
  to(`/${slug}/news`, "ok", "Notice saved. Messages already sent are not sent again.");
}

export async function deleteNotice(slug: string, id: string) {
  const { club, me } = await officer(slug);
  await withClub(club.id, async (tx) => {
    const [n] = await tx.delete(notices).where(eq(notices.id, id)).returning();
    if (n) await tx.insert(auditLog).values({ actorId: me.id, action: "notice.delete", detail: { title: n.title } });
  });
  revalidatePath(`/${slug}`, "layout");
  to(`/${slug}/news`, "ok", "Notice removed.");
}

// Members, roles and groups
export async function saveMember(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const isNew = id === "new";
  const path = isNew ? `/${slug}/officers/roster` : `/${slug}/officers/members/${id}`;
  const firstName = str(f, "firstName"), lastName = str(f, "lastName"), email = str(f, "email").toLowerCase();
  if (!firstName || !lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) to(path, "error", "A member needs a first name, last name and a working email address.");
  const t = str(f, "boatType"), x = str(f, "experience");
  const fields = {
    firstName, lastName, email, phone: str(f, "phone") || null, boatName: str(f, "boatName") || null,
    boatType: (t === "sail" || t === "power" ? t : null) as "sail" | "power" | null,
    experience: (x === "new" || x === "seasoned" ? x : "some") as "new" | "some" | "seasoned",
    role: str(f, "role") === "officer" ? ("officer" as const) : ("member" as const),
    title: str(f, "title") || null,
    active: isNew ? true : f.get("active") === "on",
  };
  if (id === me.id && (fields.role !== "officer" || !fields.active)) to(path, "error", "Ask another officer to change your own access, so the club is never locked out by mistake.");
  const groupIds = f.getAll("groups").map(String).filter(isUuid);
  let savedId = id;
  try {
    await withClub(club.id, async (tx) => {
      if (isNew) {
        [{ id: savedId }] = await tx.insert(members).values({ ...fields, linkToken: newToken(), feedToken: newToken() }).returning({ id: members.id });
      } else {
        await tx.update(members).set(fields).where(eq(members.id, id));
      }
      if ((await officerCount(tx)) === 0) throw new Error("The club needs at least one active officer. Make someone else an officer first.");
      await tx.delete(groupMembers).where(eq(groupMembers.memberId, savedId));
      if (groupIds.length) await tx.insert(groupMembers).values(groupIds.map((groupId) => ({ groupId, memberId: savedId })));
      await tx.insert(auditLog).values({ actorId: me.id, onBehalfOf: savedId, action: isNew ? "member.add" : "member.edit", detail: { role: fields.role, active: fields.active } });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(`/${slug}/officers/members/${savedId}`, "ok", isNew ? `${firstName} is on the roster.` : "Saved.");
}

export async function saveGroup(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const name = str(f, "name");
  if (!name) to(`/${slug}/officers/groups`, "error", "Give the group a name.");
  await withClub(club.id, async (tx) => {
    if (id === "new") await tx.insert(groups).values({ name });
    else await tx.update(groups).set({ name }).where(eq(groups.id, id));
    await tx.insert(auditLog).values({ actorId: me.id, action: id === "new" ? "group.add" : "group.rename", detail: { name } });
  });
  to(`/${slug}/officers/groups`, "ok", id === "new" ? `${name} added. Add people from their member page.` : "Renamed.");
}

export async function deleteGroup(slug: string, id: string) {
  const { club, me } = await officer(slug);
  await withClub(club.id, async (tx) => {
    const [g] = await tx.delete(groups).where(eq(groups.id, id)).returning();
    if (g) await tx.insert(auditLog).values({ actorId: me.id, action: "group.delete", detail: { name: g.name } });
  });
  to(`/${slug}/officers/groups`, "ok", "Group removed. Notices sent to it now show to all members.");
}

export async function removeFromGroup(slug: string, groupId: string, memberId: string) {
  const { club } = await officer(slug);
  await withClub(club.id, (tx) => tx.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.memberId, memberId))));
  to(`/${slug}/officers/groups`, "ok", "Removed from the group.");
}

// Documents and photos
const ALLOWED = new Map([
  ["application/pdf", "PDF"], ["image/jpeg", "photo"], ["image/png", "picture"], ["image/webp", "picture"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word file"],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Excel file"], ["text/plain", "text file"],
]);
const MAX_UPLOAD = 4 * 1024 * 1024;

async function storeFile(tx: Parameters<Parameters<typeof withClub>[1]>[0], file: File, membersOnly: boolean, by: string) {
  if (file.size === 0) throw new Error("Choose a file to upload.");
  if (file.size > MAX_UPLOAD) throw new Error("That file is over 4 MB. Save it smaller, or share a link to it instead.");
  if (!ALLOWED.has(file.type)) throw new Error("Upload a PDF, Word or Excel file, a text file, or a JPG or PNG picture.");
  const [row] = await tx.insert(files).values({
    name: file.name.slice(0, 120), type: file.type, size: file.size, data: Buffer.from(await file.arrayBuffer()), membersOnly, uploadedBy: by,
  }).returning({ id: files.id });
  return row.id;
}

export async function addDocument(slug: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/documents`;
  const title = str(f, "title");
  const membersOnly = f.get("membersOnly") === "on";
  const file = f.get("file");
  const link = str(f, "link");
  try {
    if (!title) throw new Error("Give the document a title.");
    await withClub(club.id, async (tx) => {
      let url = link;
      if (file instanceof File && file.size > 0) url = `/${slug}/files/${await storeFile(tx, file, membersOnly, me.id)}`;
      else if (!/^https?:\/\//.test(link)) throw new Error("Choose a file, or paste a link that starts with https://");
      await tx.insert(documents).values({ title, category: str(f, "category") || "General", url, membersOnly });
      await tx.insert(auditLog).values({ actorId: me.id, action: "document.add", detail: { title } });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(path);
  to(path, "ok", `${title} is up.`);
}

export async function deleteDocument(slug: string, id: string) {
  const { club, me } = await officer(slug);
  await withClub(club.id, async (tx) => {
    const [d] = await tx.delete(documents).where(eq(documents.id, id)).returning();
    if (!d) return;
    const fileId = d.url.match(/\/files\/([0-9a-f-]{36})$/)?.[1];
    if (fileId) await tx.delete(files).where(eq(files.id, fileId));
    await tx.insert(auditLog).values({ actorId: me.id, action: "document.delete", detail: { title: d.title } });
  });
  revalidatePath(`/${slug}/documents`);
  to(`/${slug}/documents`, "ok", "Document removed.");
}

// Club pages: about, join, contact, privacy, and the home page photo.
export async function savePage(slug: string, key: "about" | "join" | "contact" | "privacy" | "home", f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/site`;
  const photo = f.get("photo");
  try {
    await withClub(club.id, async (tx) => {
      const [existing] = await tx.select().from(clubPages).where(eq(clubPages.key, key)).limit(1);
      let photoId = existing?.photoId ?? null;
      if (photo instanceof File && photo.size > 0) {
        if (!photo.type.startsWith("image/")) throw new Error("The home page photo must be a JPG or PNG picture.");
        const old = photoId;
        photoId = await storeFile(tx, photo, false, me.id);
        if (old) await tx.delete(files).where(eq(files.id, old));
      }
      if (f.get("removePhoto") === "on" && photoId) { await tx.delete(files).where(eq(files.id, photoId)); photoId = null; }
      const values = { key, title: str(f, "title") || existing?.title || key, body: str(f, "body"), photoId, updatedBy: me.id, updatedAt: new Date() };
      if (existing) await tx.update(clubPages).set(values).where(eq(clubPages.id, existing.id));
      else await tx.insert(clubPages).values(values);
      await tx.insert(auditLog).values({ actorId: me.id, action: "page.edit", detail: { key } });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(`/${slug}`, "layout");
  to(path, "ok", "Page saved. It is live now.");
}

