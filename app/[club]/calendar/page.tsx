import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { eventsBetween, headcounts, mySignupEventIds } from "@/lib/core/data";
import { addDays } from "@/lib/core/time";
import { getViewer, origin } from "@/lib/core/viewer";
import { EventList } from "@/components/Lists";

export const metadata = { title: "Calendar" };

export default async function Page({ params }: PageProps<"/[club]/calendar">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const now = new Date();
  const { list, counts, going } = await withClub(club.id, async (tx) => {
    const list = await eventsBetween(tx, addDays(now, -0.2), addDays(now, 380));
    const ids = list.map((e) => e.id);
    return { list, counts: await headcounts(tx, ids), going: viewer ? await mySignupEventIds(tx, viewer.member.id, ids) : new Set<string>() };
  });
  const months = new Map<string, typeof list>();
  for (const e of list) {
    const key = new Intl.DateTimeFormat("en-US", { timeZone: club.timezone, month: "long", year: "numeric" }).format(e.startsAt);
    months.set(key, [...(months.get(key) ?? []), e]);
  }
  const feed = viewer ? `${(await origin()).replace(/^https?:/, "webcal:")}/${club.slug}/cal/${viewer.member.feedToken}` : null;
  return (
    <div className="wrap stack">
      <h1>Calendar</h1>
      {feed && (
        <p>
          <a className="btn quiet" href={feed}>Add to my phone&apos;s calendar</a>
          <span className="small muted" style={{ display: "block", marginTop: "0.4rem" }}>Tap once. Club events then show up in your own calendar and keep themselves up to date.</span>
        </p>
      )}
      {list.length === 0 && <p className="muted">Nothing scheduled in the next year.</p>}
      {[...months].map(([month, evs]) => (
        <section className="section" key={month}>
          <h2>{month}</h2>
          <EventList club={club} events={evs} counts={counts} going={going} />
        </section>
      ))}
    </div>
  );
}
