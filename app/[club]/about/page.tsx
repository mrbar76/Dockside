import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage } from "@/lib/core/data";
import { getViewer } from "@/lib/core/viewer";
import { ClubPageView } from "@/components/ClubPageView";

export const metadata = { title: "About" };

export default async function Page({ params }: PageProps<"/[club]/about">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const page = await withClub(club.id, (tx) => clubPage(tx, club, "about"));
  return <ClubPageView club={club} page={page} canEdit={!!viewer?.isOfficer} />;
}
