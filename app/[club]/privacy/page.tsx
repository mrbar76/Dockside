import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage } from "@/lib/core/data";
import { getViewer } from "@/lib/core/viewer";
import { ClubPageView } from "@/components/ClubPageView";

export const metadata = { title: "Privacy" };

export default async function Page({ params }: PageProps<"/[club]/privacy">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const page = await withClub(club.id, (tx) => clubPage(tx, club, "privacy"));
  return <ClubPageView club={club} page={page} canEdit={!!viewer?.isOfficer} />;
}
