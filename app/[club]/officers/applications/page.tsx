import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { requireOfficer } from "@/lib/core/viewer";
import { stageOf } from "@/lib/core/applications";
import { fmtDay } from "@/lib/core/time";

export const metadata = { title: "Applications" };

export default async function Page({ params }: PageProps<"/[club]/officers/applications">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers/applications`);
  const all = await withClub(club.id, (tx) => tx.select().from(applications).orderBy(desc(applications.createdAt)).limit(200));
  const open = all.filter((a) => a.status === "open"), done = all.filter((a) => a.status !== "open");
  const row = (a: (typeof all)[number]) => (
    <li key={a.id}>
      <Link href={`/${slug}/officers/applications/${a.id}`}><b>{a.firstName} {a.lastName}</b></Link>
      <span className="muted small"> sent {fmtDay(a.createdAt, club.timezone)}</span>
      <div className="small">{stageOf(a)}</div>
    </li>
  );
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers`}>Officers</Link></p>
      <h1>Membership applications</h1>
      <p className="lede">Each one moves through the Membership Committee, the Board of Governors and the full membership vote. The applicant is told at every step.</p>
      <section className="section stack">
        <h2>Open ({open.length})</h2>
        {open.length ? <ul className="rows">{open.map(row)}</ul> : <p className="muted">None waiting. New applications from the <Link href={`/${slug}/join/apply`}>online form</Link> land here.</p>}
      </section>
      {done.length > 0 && (
        <details className="officer-panel">
          <summary>Decided ({done.length})</summary>
          <ul className="rows">{done.map(row)}</ul>
        </details>
      )}
    </div>
  );
}
