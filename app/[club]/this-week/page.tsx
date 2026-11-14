import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { thisWeek } from "@/lib/core/data";
import { getTides } from "@/lib/core/tides";
import { getViewer } from "@/lib/core/viewer";
import { ThisWeekView } from "@/components/ThisWeekView";

export const metadata = { title: "This week" };

// Signed-in members get their own week. Anyone else (the dock QR code) gets
// the public view: events, club-wide news and tides, no member details.
export default async function Page({ params }: PageProps<"/[club]/this-week">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const now = new Date();
  const [data, tides] = await Promise.all([
    withClub(club.id, (tx) => thisWeek(tx, viewer?.member ?? null, now)),
    getTides(club.settings.noaaStation, now),
  ]);
  return <ThisWeekView club={club} data={data} tides={tides} viewer={viewer?.member ?? null} mode={viewer ? "member" : "public"} now={now} />;
}
