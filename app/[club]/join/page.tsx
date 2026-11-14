import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage, listDocuments } from "@/lib/core/data";
import { getViewer } from "@/lib/core/viewer";
import { ClubPageView } from "@/components/ClubPageView";

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
      {docs.length > 0 && (
        <section className="section">
          <h2>Forms</h2>
          <ul className="rows">{docs.map((d) => <li key={d.id}><a href={d.url}>{d.title}</a></li>)}</ul>
        </section>
      )}
      {club.settings.contactEmail && <p>Questions first? Write to <a href={`mailto:${club.settings.contactEmail}`}>{club.settings.contactEmail}</a>.</p>}
    </ClubPageView>
  );
}
