import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { applications, members } from "@/lib/db/schema";
import { requireOfficer } from "@/lib/core/viewer";
import { STEPS, fmtMoney, membershipRules, stageOf } from "@/lib/core/applications";
import { fmtDay } from "@/lib/core/time";
import { Flash } from "@/components/Flash";
import { declineApplication, recordStep, saveApplicationNotes } from "../../../apply-actions";

export const metadata = { title: "Application" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/officers/applications/[id]">) {
  const { club: slug, id } = await params;
  const club = await requireClub(slug);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireOfficer(club, `/${slug}/officers/applications/${id}`);
  const { a, people } = await withClub(club.id, async (tx) => ({
    a: (await tx.select().from(applications).where(eq(applications.id, id)).limit(1))[0],
    people: await tx.select({ id: members.id, firstName: members.firstName, lastName: members.lastName }).from(members).where(and(eq(members.active, true))).orderBy(asc(members.lastName)),
  }));
  if (!a) notFound();
  const r = membershipRules(club);
  const tz = club.timezone;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const next = STEPS.find((s) => !a[s.key]);
  const facts: [string, string][] = [
    ["Email", a.email], ["Phone", a.phone], ["Business phone", a.businessPhone], ["Address", `${a.address} ${a.zip}`.trim()],
    ["Occupation", a.occupation], ["Spouse or partner", a.spouseName], ["Children", a.children],
    ["Boat", [a.boatName, a.boatType, a.boatLength && `${a.boatLength} ft`, a.boatBeam && `beam ${a.boatBeam} ft`].filter(Boolean).join(", ")],
    ["Wants to help with", [...a.interests, a.interestsOther].filter(Boolean).join(", ")],
    ["Residency", a.residencyCertified ? "Certified by the applicant" : "Not certified"],
  ];
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers/applications`}>Applications</Link></p>
      <h1>{a.firstName} {a.lastName}</h1>
      <Flash sp={await searchParams} />
      <p className="next-up"><b>{stageOf(a)}</b> <span className="muted small">Sent {fmtDay(a.createdAt, tz)}.</span></p>

      <dl className="facts">{facts.filter(([, v]) => v).map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>

      {a.proofIds.length > 0 && (
        <section className="stack">
          <h2>Proofs of residency</h2>
          <ul className="rows">{a.proofIds.map((p, i) => <li key={p}><a href={`/${slug}/files/${p}`} target="_blank" rel="noreferrer">Proof {i + 1}</a></li>)}</ul>
          <p className="small muted">Officers only. Deleted automatically when the application is decided.</p>
        </section>
      )}

      {a.status === "open" ? (
        <>
          <form className="form stack" action={saveApplicationNotes.bind(null, slug, id)}>
            <h2>Sponsor and payment</h2>
            <p>{a.sponsoredAt ? <>Sponsor: <b>{a.sponsorName}</b>, {a.sponsorHow}, {fmtDay(a.sponsoredAt, tz)}.</> : a.sponsorName ? <>Named sponsor: <b>{a.sponsorName}</b> {a.sponsorPhone} {a.sponsorEmail}. Not signed off yet.</> : <>No sponsor named. The applicant asked to be put in touch with a member.</>}</p>
            {!a.sponsoredAt && (
              <div className="inline">
                <label className="field" style={{ flex: 1, minWidth: "12rem" }}><span>Sponsor confirmed</span>
                  <select name="sponsorId" defaultValue=""><option value="">Not yet</option>{people.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}</select>
                </label>
                <label className="field" style={{ flex: 1, minWidth: "12rem" }}><span>How</span><input name="sponsorHow" placeholder="signed the paper form" maxLength={100} /></label>
              </div>
            )}
            {r.fees && <label className="check"><input type="checkbox" name="paid" defaultChecked={!!a.paidAt} /><span>Check for {fmtMoney(r.fees.initiation + r.fees.dues)} received{a.paidAt ? ` (${fmtDay(a.paidAt, tz)})` : ""}</span></label>}
            <label className="field"><span>Check number or note</span><input name="paymentNote" defaultValue={a.paymentNote} maxLength={200} /></label>
            <label className="field"><span>Committee notes <i className="muted">officers only</i></span><textarea name="officerNotes" defaultValue={a.officerNotes} maxLength={3000} /></label>
            <button className="btn">Save</button>
          </form>

          <section className="form stack">
            <h2>Sign-offs</h2>
            <ol className="steps">
              {STEPS.map((s) => <li key={s.key} className={a[s.key] ? "done" : ""}><span>{s.label}</span><span className="muted small">{a[s.key] ? fmtDay(a[s.key]!, tz) : "Not yet"}</span></li>)}
            </ol>
            {next && (
              <form className="inline" action={recordStep.bind(null, slug, id, next.key)}>
                <label className="field" style={{ width: "11rem" }}><span>Date</span><input name="on" type="date" defaultValue={today} /></label>
                <button className="btn go">{next.key === "voteAt" ? "Voted in: make a member" : `${next.label} approved`}</button>
              </form>
            )}
            {(!a.sponsoredAt || (r.fees && !a.paidAt)) && <p className="small muted">You can record a sign-off before the sponsor or check is in. The applicant sees what is still missing.</p>}
          </section>

          <details className="officer-panel">
            <summary>Decline the application</summary>
            <form className="stack" action={declineApplication.bind(null, slug, id)}>
              <label className="field"><span>Note to the applicant <i className="muted">optional</i></span><textarea name="decisionNote" maxLength={1000} /></label>
              <label className="check"><input type="checkbox" name="tell" defaultChecked /><span>Email {a.firstName}</span></label>
              <button className="btn danger">Decline</button>
            </form>
          </details>
        </>
      ) : (
        <p>{a.status === "approved" && a.memberId ? <Link href={`/${slug}/officers/members/${a.memberId}`}>Open {a.firstName}&apos;s member record</Link> : a.decisionNote}</p>
      )}
    </div>
  );
}
