import { notFound } from "next/navigation";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { memberByLinkToken, thisWeek } from "@/lib/core/data";
import { getTides } from "@/lib/core/tides";
import { ThisWeekView } from "@/components/ThisWeekView";

export const metadata = { title: "This week", robots: { index: false } };

// The personal link from the weekly message. No sign-in: it only reads, and
// only low-risk things. Changing anything asks for a real sign-in.
export default async function Page({ params }: PageProps<"/[club]/w/[token]">) {
  const { club: slug, token } = await params;
  const club = await requireClub(slug);
  const now = new Date();
  const result = await withClub(club.id, async (tx) => {
    const member = await memberByLinkToken(tx, token);
    return member ? { member, data: await thisWeek(tx, member, now) } : null;
  });
  if (!result) notFound();
  const tides = await getTides(club.settings.noaaStation, now);
  return <ThisWeekView club={club} data={result.data} tides={tides} viewer={result.member} mode="link" now={now} />;
}
