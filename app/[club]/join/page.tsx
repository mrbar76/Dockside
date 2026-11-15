import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage, listDocuments } from "@/lib/core/data";
import { getViewer } from "@/lib/core/viewer";
import { ClubPageView } from "@/components/ClubPageView";
import Link from "next/link";
import { fmtMoney, membershipRules } from "@/lib/core/applications";

export const metadata = { title: "Joining" };

export default async function Page({ params }: PageProps<"/[club]/join">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const { page, docs } = await withClub(club.id, async (tx) => ({
    page: await clubPage(tx, club, "join"),
    docs: (await listDocuments(tx, false)).filter((d) => d.category.toLowerCase() === "join"),
  }));
  return (
    <ClubPageView club={club} page={page} canEdit={!!viewer?.isOfficer}>
      <section className="section stack">
        <p><Link className="btn go" href={`/${club.slug}/join/apply`}>Apply online</Link></p>
        {(() => { const r = membershipRules(club); return (
          <ul className="bullets">
            {r.residency && <li>Open to residents of {r.residency}. You add two proofs of residency to the form.</li>}
            {r.sponsorRequired && <li>A current member sponsors you. Don&apos;t know one yet? Say so on the form.</li>}
            {r.fees && <li>{fmtMoney(r.fees.initiation)} initiation and {fmtMoney(r.fees.dues)} annual dues, {fmtMoney(r.fees.initiation + r.fees.dues)} with your application, by check.</li>}
            <li>The Membership Committee, then the Board of Governors, then the full membership vote. You see each step online.</li>
          </ul>
        ); })()}
      </section>
      {docs.length > 0 && (
        <section className="section">
          <h2>Paper forms</h2>
          <ul className="rows">{docs.map((d) => <li key={d.id}><a href={d.url}>{d.title}</a></li>)}</ul>
        </section>
      )}
      {club.settings.contactEmail && <p>Questions first? Write to <a href={`mailto:${club.settings.contactEmail}`}>{club.settings.contactEmail}</a>.</p>}
    </ClubPageView>
  );
}
