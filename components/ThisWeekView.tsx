import Link from "next/link";
import type { Club, Member } from "@/lib/db/schema";
import type { ThisWeek } from "@/lib/core/data";
import type { Tide } from "@/lib/core/tides";
import type { Wind } from "@/lib/core/wind";
import { addDays, fmtDayShort, fmtWhen } from "@/lib/core/time";
import { BoaterLine } from "./BoaterLine";
import { EventList, NoticeList, RideTeasers, UrgentNotices } from "./Lists";
import { TidePanel } from "./TidePanel";

// One page a returning member can read in half a minute: what is urgent, the
// water, this week's events, open seats, the news.
// mode "public" is what the dock QR code shows: no member details at all.
export function ThisWeekView({ club, data, tides, viewer, mode, now, wind = null, position = null }: {
  club: Club; data: ThisWeek; tides: Tide[]; viewer: Member | null; mode: "member" | "link" | "public"; now: Date;
  wind?: Wind | null; position?: string | null;
}) {
  const urgent = data.notices.filter((n) => n.urgent);
  const news = data.notices.filter((n) => !n.urgent);
  const base = `/${club.slug}`;
  const tz = club.timezone;
  // The one thing this member has coming up, and the one button that matters.
  const myEvent = viewer ? data.events.find((e) => data.going.has(e.id) && e.startsAt > now && !e.cancelledAt) : undefined;
  const myRide = viewer ? data.rides.find((r) => r.owner.id === viewer.id || r.requests.some((q) => q.member.id === viewer.id && q.req.status === "accepted")) : undefined;
  const nextUp = [
    myEvent && { at: myEvent.startsAt, text: myEvent.title, href: `${base}/calendar/${myEvent.id}` },
    myRide && { at: myRide.offer.departsAt, text: myRide.owner.id === viewer?.id ? `Your boat: ${myRide.offer.title}` : `Aboard ${myRide.owner.boatName ?? `${myRide.owner.firstName}'s boat`}: ${myRide.offer.title}`, href: `${base}/rides#${myRide.offer.id}` },
  ].filter((x): x is { at: Date; text: string; href: string } => !!x).sort((a, b) => +a.at - +b.at)[0];
  const openEvent = data.events.find((e) => e.signup && !e.cancelledAt && e.startsAt > now && !data.going.has(e.id));
  const main = mode === "public"
    ? { href: `${base}/sign-in?next=${encodeURIComponent(`${base}/this-week`)}`, label: "Member sign in" }
    : nextUp ? { href: nextUp.href, label: "Open it" }
    : openEvent ? { href: `${base}/calendar/${openEvent.id}`, label: `Sign up: ${openEvent.title}` }
    : { href: `${base}/calendar`, label: "See the calendar" };
  return (
    <div className="wrap stack" style={{ "--gap": "1.5rem" } as React.CSSProperties}>
      <header>
        <h1>This week</h1>
        <p className="muted">
          {fmtDayShort(now, club.timezone)} to {fmtDayShort(addDays(now, 7), club.timezone)}
          {viewer ? `. Hello, ${viewer.firstName}.` : ""}
        </p>
        {mode === "link" && (
          <p className="small muted">
            Opened with your personal link, so there is nothing to sign in to. <Link href={`${base}/sign-in`}>Sign in</Link> to sign up for events or raise a hand for a ride.
          </p>
        )}
        {viewer && (
          <p className="next-up">
            {nextUp ? <><b>Your next:</b> {nextUp.text}, {fmtWhen(nextUp.at, tz)}.</> : <>Nothing on your list this week.</>}
          </p>
        )}
        {mode !== "link" && <p><a className="btn go" href={main.href}>{main.label}</a></p>}
      </header>
      <UrgentNotices notices={urgent} />
      <BoaterLine wind={wind} tides={tides} tz={tz} now={now} vhf={club.settings.vhf} position={position} />
      <TidePanel tides={tides} tz={club.timezone} now={now} place={club.settings.place} />
      <section className="section">
        <h2>On the calendar</h2>
        <EventList club={club} events={data.events} counts={data.counts} going={data.going} />
        <p style={{ marginTop: "0.8rem" }}><Link href={`${base}/calendar`}>All upcoming events</Link></p>
      </section>
      <section className="section">
        <h2>Open seats</h2>
        {mode === "public" ? (
          <p>
            {data.rides.length === 0 ? "No open seats right now." : `${data.rides.length} boat${data.rides.length === 1 ? " has" : "s have"} room for crew or guests.`}{" "}
            <Link href={`${base}/sign-in?next=${encodeURIComponent(`${base}/rides`)}`}>Sign in to see them</Link>
          </p>
        ) : (
          <RideTeasers club={club} rides={data.rides} />
        )}
      </section>
      <section className="section">
        <h2>News</h2>
        <NoticeList notices={news} tz={club.timezone} />
        <p style={{ marginTop: "0.8rem" }}><Link href={`${base}/news`}>All news</Link></p>
      </section>
    </div>
  );
}
