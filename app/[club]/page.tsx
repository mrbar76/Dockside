import Image from "next/image";
import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage, thisWeek } from "@/lib/core/data";
import { getTides } from "@/lib/core/tides";
import { getConditions } from "@/lib/core/wind";
import { getViewer } from "@/lib/core/viewer";
import { BoaterLine } from "@/components/BoaterLine";
import { EventList } from "@/components/Lists";
import { Prose } from "@/components/Prose";
import { TidePanel } from "@/components/TidePanel";

// The club's public site. The first screen answers a neighbour's questions:
// who you are, where you are, how to join, how to reach you.
export default async function ClubHome({ params }: PageProps<"/[club]">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const now = new Date();
  const [{ data, home, about }, tides, { wind, position }] = await Promise.all([
    withClub(club.id, async (tx) => ({
      data: await thisWeek(tx, null, now),
      home: await clubPage(tx, club, "home"),
      about: await clubPage(tx, club, "about"),
    })),
    getTides(club.settings.noaaStation, now),
    getConditions(club.settings),
  ]);
  const base = `/${club.slug}`;
  const photo = "photoId" in home ? home.photoId : null;
  return (
    <>
      <section className="hero">
        <div className="wrap wide">
          <p className="place">{club.settings.address ?? club.settings.place}</p>
          <h1>{club.name}</h1>
          <p className="lede" style={{ marginTop: "0.9rem" }}>{club.tagline}</p>
          <div className="actions">
            {viewer
              ? <Link className="btn go" href={`${base}/this-week`}>See this week</Link>
              : <Link className="btn go" href={`${base}/join`}>Join the club</Link>}
            <Link className="btn quiet" href={viewer ? `${base}/calendar` : `${base}/this-week`}>{viewer ? "Calendar" : "What's on this week"}</Link>
            {!viewer && <Link className="btn quiet" href={`${base}/sign-in`}>Member sign in</Link>}
          </div>
          <p className="small hero-contact">
            <Link href={`${base}/contact`}>Contact</Link>
            {club.settings.contactEmail && <> or write to <a href={`mailto:${club.settings.contactEmail}`}>{club.settings.contactEmail}</a></>}
          </p>
        </div>
      </section>
      {photo && (
        <div className="wrap wide home-photo">
          <Image src={`${base}/files/${photo}`} alt={`${club.name} from the water`} fill sizes="(min-width: 960px) 960px, 100vw" priority />
        </div>
      )}
      <div className="wrap wide cols section">
        <div className="stack" style={{ "--gap": "1.5rem" } as React.CSSProperties}>
          <BoaterLine wind={wind} tides={tides} tz={club.timezone} now={now} vhf={club.settings.vhf} position={position} />
          <TidePanel tides={tides} tz={club.timezone} now={now} place={club.settings.place} />
          <section>
            <h2 style={{ marginBottom: "0.9rem" }}>On the calendar</h2>
            <EventList club={club} events={data.events.slice(0, 4)} />
          </section>
        </div>
        <div className="stack" style={{ "--gap": "1.5rem" } as React.CSSProperties}>
          {home.body && <section className="stack"><Prose text={home.body} /></section>}
          <section className="stack">
            <h2>{about.title}</h2>
            <Prose text={about.body.split(/\n{2,}/)[0]} />
            <p><Link href={`${base}/about`}>More about the club</Link></p>
          </section>
          <section className="stack">
            <h2>Joining</h2>
            <p>New members are welcome. <Link href={`${base}/join`}>How to join</Link></p>
          </section>
        </div>
      </div>
    </>
  );
}
