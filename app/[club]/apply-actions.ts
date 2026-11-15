"use server";
// Membership applications. The public form is the only write a visitor can
// make without signing in, so it is checked hard: size caps, a hidden trap
// field for robots, and proofs stored officer-only.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, ilike } from "drizzle-orm";
import { withClub, type Tx } from "@/lib/db";
import { applications, auditLog, files, groupMembers, groups, households, members, type Application, type Club } from "@/lib/db/schema";
import { requireClub } from "@/lib/core/clubs";
import { getViewer, origin } from "@/lib/core/viewer";
import { newToken } from "@/lib/core/data";
import { deliverTo } from "@/lib/core/deliver";
import { STEPS, dropProofs, findSponsor, membershipRules, stageOf, tellApplicant, tellOfficers, type StepKey } from "@/lib/core/applications";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const msg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.");
const to = (path: string, kind: "ok" | "error", text: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${encodeURIComponent(text)}`);
const isUuid = (s: string) => /^[0-9a-f-]{36}$/.test(s);
const PROOF_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);
const PROOF_MAX = 2 * 1024 * 1024;

export async function submitApplication(slug: string, f: FormData) {
  const club = await requireClub(slug);
  const rules = membershipRules(club);
  const path = `/${slug}/join/apply`;
  if (str(f, "website")) to(`/${slug}/join`, "ok", "Thanks. The Membership Committee will be in touch."); // robots fill hidden fields
  const firstName = str(f, "firstName", 60), lastName = str(f, "lastName", 60), email = str(f, "email", 120).toLowerCase();
  let token = "";
  try {
    if (!firstName || !lastName) throw new Error("Add your first and last name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Add an email address the club can reach you at.");
    if (!str(f, "phone")) throw new Error("Add a phone number.");
    if (!str(f, "address") || !str(f, "zip", 10)) throw new Error("Add your street address and zip code.");
    if (rules.sponsorRequired && !str(f, "sponsorName") && f.get("noSponsor") !== "on") throw new Error("Name your sponsor, or tick the box if you don't know a member yet.");
    if (rules.residency && f.get("residency") !== "on") throw new Error(`Confirm that you live in ${rules.residency}.`);
    const proofs = f.getAll("proofs").filter((p): p is File => p instanceof File && p.size > 0);
    if (proofs.length < rules.proofsRequired) throw new Error(`Add ${rules.proofsRequired} proofs of residency, such as a utility bill and a driver's license.`);
    for (const p of proofs) {
      if (p.size > PROOF_MAX) throw new Error(`${p.name} is over 2 MB. Take the photo again, or save the PDF smaller.`);
      if (!PROOF_TYPES.has(p.type)) throw new Error(`${p.name}: upload a photo (JPG or PNG) or a PDF.`);
    }
    token = newToken();
    const interests = f.getAll("interests").map(String).filter((i) => rules.committees.includes(i));
    const base = await origin();
    await withClub(club.id, async (tx) => {
      const recent = await tx.select({ id: applications.id }).from(applications).where(and(ilike(applications.email, email), eq(applications.status, "open")));
      if (recent.length >= 2) throw new Error("There is already an application open for this email. The Membership Committee will be in touch.");
      const proofIds: string[] = [];
      for (const p of proofs.slice(0, 4)) {
        const [row] = await tx.insert(files).values({ name: p.name.slice(0, 120), type: p.type, size: p.size, data: Buffer.from(await p.arrayBuffer()), membersOnly: true, officersOnly: true }).returning({ id: files.id });
        proofIds.push(row.id);
      }
      const sponsorEmail = str(f, "sponsorEmail", 120).toLowerCase();
      const [a] = await tx.insert(applications).values({
        firstName, lastName, email, phone: str(f, "phone", 40), address: str(f, "address"), zip: str(f, "zip", 10),
        occupation: str(f, "occupation", 100), businessPhone: str(f, "businessPhone", 40), spouseName: str(f, "spouseName", 100),
        children: str(f, "children", 300), boatName: str(f, "boatName", 60), boatType: str(f, "boatType", 40),
        boatLength: str(f, "boatLength", 12), boatBeam: str(f, "boatBeam", 12),
        sponsorName: str(f, "sponsorName", 100), sponsorPhone: str(f, "sponsorPhone", 40), sponsorEmail,
        interests, interestsOther: str(f, "interestsOther", 300), residencyCertified: f.get("residency") === "on",
        proofIds, statusToken: token,
      }).returning();
      const statusUrl = `${base}/${slug}/join/status/${token}`;
      await tellApplicant(tx, club, a, {
        subject: `Your application to ${club.shortName}`,
        body: `Thanks, ${firstName}. Your application is in.${rules.fees ? ` Please mail a check for ${rules.fees.initiation + rules.fees.dues} dollars payable to ${rules.fees.payTo ?? club.shortName}${rules.fees.mailTo ? ` to ${rules.fees.mailTo}` : ""}.` : ""} You can see where it stands here:`,
        url: statusUrl,
      });
      const sponsor = await findSponsor(tx, sponsorEmail);
      if (sponsor) await deliverTo(tx, club, sponsor, { subject: `${firstName} ${lastName} named you as sponsor`, body: `${firstName} ${lastName} applied to join and named you as sponsor. Sign off if you are happy to sponsor them.`, url: `${base}/${slug}/join/sponsor/${a.id}` }, "application");
      await tellOfficers(tx, club, { subject: `New membership application: ${firstName} ${lastName}`, body: `${firstName} ${lastName} applied online${a.sponsorName ? `, sponsored by ${a.sponsorName}` : ", with no sponsor yet"}.`, url: `${base}/${slug}/officers/applications/${a.id}` });
    });
  } catch (e) { to(path, "error", msg(e)); }
  redirect(`/${slug}/join/status/${token}?ok=${encodeURIComponent("Your application is in. Keep this page: it shows where things stand.")}`);
}

export async function withdrawApplication(slug: string, token: string) {
  const club = await requireClub(slug);
  await withClub(club.id, async (tx) => {
    const [a] = await tx.select().from(applications).where(eq(applications.statusToken, token));
    if (!a || a.status !== "open") return;
    await tx.update(applications).set({ status: "withdrawn", decidedAt: new Date() }).where(eq(applications.id, a.id));
    await dropProofs(tx, a);
    await tellOfficers(tx, club, { subject: `Application withdrawn: ${a.firstName} ${a.lastName}`, body: "The applicant withdrew. Their proofs of residency were deleted.", url: `${await origin()}/${slug}/officers/applications` });
  });
  to(`/${slug}/join/status/${token}`, "ok", "Your application is withdrawn, and your proofs of residency are deleted.");
}

// A member signs off as sponsor. Only a signed-in member can do it.
export async function sponsorApplication(slug: string, id: string) {
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  const path = `/${slug}/join/sponsor/${id}`;
  if (!viewer) redirect(`/${slug}/sign-in?next=${encodeURIComponent(path)}`);
  if (!isUuid(id)) to(path, "error", "That link is not right.");
  await withClub(club.id, async (tx) => {
    const [a] = await tx.select().from(applications).where(eq(applications.id, id));
    if (!a || a.status !== "open") return;
    await tx.update(applications).set({ sponsorId: viewer.member.id, sponsoredAt: new Date(), sponsorHow: "signed off online", sponsorName: `${viewer.member.firstName} ${viewer.member.lastName}` }).where(eq(applications.id, id));
    await tx.insert(auditLog).values({ actorId: viewer.member.id, action: "application.sponsor", detail: { applicant: `${a.firstName} ${a.lastName}` } });
    await tellOfficers(tx, club, { subject: `Sponsor signed off: ${a.firstName} ${a.lastName}`, body: `${viewer.member.firstName} ${viewer.member.lastName} signed off as sponsor.`, url: `${await origin()}/${slug}/officers/applications/${id}` });
  });
  to(path, "ok", "Thank you. You are on record as sponsor.");
}

// ---------- officers ----------

async function officer(slug: string) {
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  if (!viewer) redirect(`/${slug}/sign-in`);
  if (!viewer.isOfficer) redirect(`/${slug}/this-week`);
  return { club, me: viewer.member };
}

async function load(tx: Tx, id: string) {
  if (!isUuid(id)) throw new Error("Application not found.");
  const [a] = await tx.select().from(applications).where(eq(applications.id, id));
  if (!a) throw new Error("Application not found.");
  return a;
}

export async function saveApplicationNotes(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/applications/${id}`;
  try {
    await withClub(club.id, async (tx) => {
      await load(tx, id);
      const sponsorId = str(f, "sponsorId");
      const set: Partial<Application> = { officerNotes: str(f, "officerNotes", 3000), paymentNote: str(f, "paymentNote", 200) };
      const paid = f.get("paid") === "on";
      const a = await load(tx, id);
      if (paid && !a.paidAt) set.paidAt = new Date();
      if (!paid) set.paidAt = null;
      if (isUuid(sponsorId) && sponsorId !== a.sponsorId) {
        const [m] = await tx.select().from(members).where(eq(members.id, sponsorId));
        if (m) Object.assign(set, { sponsorId, sponsorName: `${m.firstName} ${m.lastName}`, sponsoredAt: new Date(), sponsorHow: str(f, "sponsorHow", 100) || `confirmed by ${me.firstName} ${me.lastName}` });
      }
      await tx.update(applications).set(set).where(eq(applications.id, id));
      await tx.insert(auditLog).values({ actorId: me.id, action: "application.update", detail: { id, paid } });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(path);
  to(path, "ok", "Saved.");
}

// Records a sign-off with its date. The last one makes the person a member.
export async function recordStep(slug: string, id: string, step: StepKey, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/applications/${id}`;
  const when = str(f, "on", 10);
  const at = /^\d{4}-\d{2}-\d{2}$/.test(when) ? new Date(`${when}T12:00:00Z`) : new Date();
  let done = "";
  try {
    if (!STEPS.some((s) => s.key === step)) throw new Error("Unknown step.");
    const base = await origin();
    await withClub(club.id, async (tx) => {
      const a = await load(tx, id);
      if (a.status !== "open") throw new Error("This application is already decided.");
      const i = STEPS.findIndex((s) => s.key === step);
      if (STEPS.slice(0, i).some((s) => !a[s.key])) throw new Error(`Record the ${STEPS[i - 1].label} first.`);
      await tx.update(applications).set({ [step]: at }).where(eq(applications.id, id));
      await tx.insert(auditLog).values({ actorId: me.id, action: "application.step", detail: { id, step } });
      if (step === "voteAt") {
        const memberId = await admit(tx, club, { ...a, voteAt: at });
        await tx.update(applications).set({ status: "approved", decidedAt: new Date(), memberId }).where(eq(applications.id, id));
        await dropProofs(tx, a);
        await tellApplicant(tx, club, a, { subject: `Welcome to ${club.shortName}`, body: `${a.firstName}, the membership voted you in. Welcome aboard. Sign in with this email address to see what is on this week.`, url: `${base}/${slug}/sign-in?email=${encodeURIComponent(a.email)}` });
        done = `${a.firstName} is a member. They have been sent a welcome, and their proofs of residency were deleted.`;
      } else {
        const label = STEPS[STEPS.findIndex((s) => s.key === step)].label;
        await tellApplicant(tx, club, a, { subject: `Your ${club.shortName} application: ${label} done`, body: stageOf({ ...a, [step]: at }), url: `${base}/${slug}/join/status/${a.statusToken}` });
        done = `${label} recorded. ${a.firstName} has been told.`;
      }
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(path);
  to(path, "ok", done);
}

async function admit(tx: Tx, club: Club, a: Application) {
  const boatType = /sail/i.test(a.boatType) ? "sail" : a.boatName || a.boatType ? "power" : null;
  const spouse = a.spouseName.trim().split(/\s+/);
  let householdId: string | null = null;
  if (spouse[0]) [{ id: householdId }] = await tx.insert(households).values({ name: `${a.lastName} household` }).returning({ id: households.id });
  const base = { email: a.email, phone: a.phone || null, householdId, active: true };
  const [m] = await tx.insert(members).values({
    ...base, firstName: a.firstName, lastName: a.lastName, boatName: a.boatName || null, boatType, experience: a.boatName ? "some" : "new",
    linkToken: newToken(), feedToken: newToken(),
  }).returning();
  const ids = [m.id];
  if (spouse[0]) {
    const [s] = await tx.insert(members).values({
      ...base, firstName: spouse[0], lastName: spouse.slice(1).join(" ") || a.lastName, experience: "some", linkToken: newToken(), feedToken: newToken(),
    }).returning({ id: members.id });
    ids.push(s.id);
  }
  // Committee interests become group memberships where a group of that name exists.
  const gs = await tx.select().from(groups);
  const want = gs.filter((g) => a.interests.some((i) => g.name.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(g.name.toLowerCase())));
  for (const g of want) for (const memberId of ids) await tx.insert(groupMembers).values({ groupId: g.id, memberId }).onConflictDoNothing();
  return m.id;
}

export async function declineApplication(slug: string, id: string, f: FormData) {
  const { club, me } = await officer(slug);
  const path = `/${slug}/officers/applications/${id}`;
  try {
    await withClub(club.id, async (tx) => {
      const a = await load(tx, id);
      if (a.status !== "open") throw new Error("This application is already decided.");
      const note = str(f, "decisionNote", 1000);
      await tx.update(applications).set({ status: "declined", decidedAt: new Date(), decisionNote: note }).where(eq(applications.id, id));
      await dropProofs(tx, a);
      await tx.insert(auditLog).values({ actorId: me.id, action: "application.decline", detail: { id } });
      if (f.get("tell") === "on")
        await tellApplicant(tx, club, a, { subject: `Your ${club.shortName} application`, body: `${a.firstName}, thank you for applying. The club is not able to accept your application at this time.${note ? `\n\n${note}` : ""}`, url: `${await origin()}/${slug}` });
    });
  } catch (e) { to(path, "error", msg(e)); }
  revalidatePath(path);
  to(path, "ok", "Application declined. Proofs of residency were deleted.");
}
