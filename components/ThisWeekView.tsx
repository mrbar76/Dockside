import Link from "next/link";
import type { Club, Member } from "@/lib/db/schema";
import type { ThisWeek } from "@/lib/core/data";
import type { Tide } from "@/lib/core/tides";
import { addDays, fmtDayShort } from "@/lib/core/time";
import { EventList, NoticeList, RideTeasers, UrgentNotices } from "./Lists";
import { TidePanel } from "./TidePanel";

// One page a returning member can read in half a minute: what is urgent, the
// water, this week's events, open seats, the news.
// mode "public" is what the dock QR code shows: no member details at all.
export function ThisWeekView({ club, data, tides, viewer, mode, now }: {
  club: Club; data: ThisWeek; tides: Tide[]; viewer: Member | null; mode: "member" | "link" | "public"; now: Date;
}) {
  const urgent = data.notices.filter((n) => n.urgent);
  const news = data.notices.filter((n) => !n.urgent);
  const base = `/${club.slug}`;
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
      </header>
      <UrgentNotices notices={urgent} />
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
      </section>
    </div>
  );
}
