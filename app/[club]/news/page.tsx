import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { noticesFor } from "@/lib/core/data";
import { addDays } from "@/lib/core/time";
import { getViewer } from "@/lib/core/viewer";
import { NoticeList, UrgentNotices } from "@/components/Lists";

export const metadata = { title: "News" };

export default async function Page({ params }: PageProps<"/[club]/news">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const list = await withClub(club.id, (tx) => noticesFor(tx, viewer?.member ?? null, addDays(new Date(), -90), 50));
  const fresh = addDays(new Date(), -3);
  return (
    <div className="wrap stack">
      <h1>News</h1>
      <UrgentNotices notices={list.filter((n) => n.urgent && n.publishedAt > fresh)} />
      <NoticeList notices={list.filter((n) => !(n.urgent && n.publishedAt > fresh))} tz={club.timezone} />
    </div>
  );
}
