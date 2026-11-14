import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage } from "@/lib/core/data";
import { getStationPosition } from "@/lib/core/tides";
import { getViewer } from "@/lib/core/viewer";
import { ClubPageView } from "@/components/ClubPageView";

export const metadata = { title: "Contact" };

export default async function Page({ params }: PageProps<"/[club]/contact">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const [page, position] = await Promise.all([withClub(club.id, (tx) => clubPage(tx, club, "contact")), getStationPosition(club.settings.noaaStation)]);
  return (
    <ClubPageView club={club} page={page} canEdit={!!viewer?.isOfficer}>
      <dl className="facts">
        {club.settings.contactEmail && <><dt>Email</dt><dd><a href={`mailto:${club.settings.contactEmail}`}>{club.settings.contactEmail}</a></dd></>}
        <dt>Where</dt><dd>{club.settings.address ?? club.settings.place}</dd>
        {position && <><dt>By water</dt><dd>{position}{club.settings.vhf ? `, monitoring ${club.settings.vhf}` : ""}</dd></>}
      </dl>
    </ClubPageView>
  );
}
