import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { listDocuments, thisWeek } from "@/lib/core/data";
import { getTides } from "@/lib/core/tides";
import { getViewer } from "@/lib/core/viewer";
import { EventList } from "@/components/Lists";
import { TidePanel } from "@/components/TidePanel";

// The club's public site: who we are, the water today, what is on this week.
export default async function ClubHome({ params }: PageProps<"/[club]">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const now = new Date();
  const [data, docs, tides] = await Promise.all([
    withClub(club.id, (tx) => thisWeek(tx, null, now)),
    withClub(club.id, (tx) => listDocuments(tx, false)),
    getTides(club.settings.noaaStation, now),
  ]);
  const base = `/${club.slug}`;
  return (
    <>
      <section className="hero">
        <div className="wrap wide">
          <p className="place">{club.settings.place}</p>
          <h1>{club.name}</h1>
          <p className="lede" style={{ marginTop: "0.9rem" }}>{club.tagline}</p>
          <div className="actions">
            <Link className="btn" href={`${base}/this-week`}>See this week</Link>
            {!viewer && <Link className="btn quiet" href={`${base}/sign-in`}>Member sign in</Link>}
          </div>
        </div>
      </section>
      <div className="wrap wide cols section">
        <div className="stack" style={{ "--gap": "1.5rem" } as React.CSSProperties}>
          <TidePanel tides={tides} tz={club.timezone} now={now} place={club.settings.place} />
          <section>
            <h2 style={{ marginBottom: "0.9rem" }}>On the calendar</h2>
            <EventList club={club} events={data.events.slice(0, 4)} />
          </section>
        </div>
        <div className="stack" style={{ "--gap": "1.5rem" } as React.CSSProperties}>
          <section className="stack">
            <h2>About the club</h2>
            <p>{club.about}</p>
          </section>
          {docs.length > 0 && (
            <section className="stack">
              <h2>Joining</h2>
              <ul className="stack">{docs.map((d) => <li key={d.id}><a href={d.url}>{d.title}</a></li>)}</ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
