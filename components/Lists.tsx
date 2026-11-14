import Link from "next/link";
import type { Club, EventRow, Notice } from "@/lib/db/schema";
import type { OfferView } from "@/lib/core/data";
import { fmtDayNum, fmtTime, fmtWeekday, fmtWhen } from "@/lib/core/time";

export function EventList({ club, events, counts, going }: { club: Club; events: EventRow[]; counts?: Map<string, number>; going?: Set<string> }) {
  if (events.length === 0) return <p className="muted">Nothing on the calendar for these days.</p>;
  return (
    <ul className="rows">
      {events.map((e) => {
        const n = counts?.get(e.id) ?? 0;
        return (
          <li key={e.id}>
            <Link className="event" href={`/${club.slug}/calendar/${e.id}`}>
              <span className="date"><span>{fmtWeekday(e.startsAt, club.timezone)}</span><b>{fmtDayNum(e.startsAt, club.timezone)}</b></span>
              <span>
                <h3>{e.cancelledAt ? "Cancelled: " : ""}{e.title}</h3>
                <span className="meta">
                  {fmtTime(e.startsAt, club.timezone)}{e.location ? `, ${e.location}` : ""}
                  {e.signup && n > 0 ? `. ${n} going` : ""}
                </span>
                {going?.has(e.id) && <> <span className="tag">You are going</span></>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function NoticeList({ notices, tz }: { notices: Notice[]; tz: string }) {
  if (notices.length === 0) return <p className="muted">No news in the last two weeks.</p>;
  return (
    <ul className="rows">
      {notices.map((n) => (
        <li key={n.id} className="notice">
          <h3>{n.title}</h3>
          <p>{n.body}</p>
          <p className="muted small">{fmtWhen(n.publishedAt, tz)}{n.groupId ? ". Sent to a group you are in" : ""}</p>
        </li>
      ))}
    </ul>
  );
}

export function UrgentNotices({ notices }: { notices: Notice[] }) {
  return (
    <>
      {notices.map((n) => (
        <article key={n.id} className="notice urgent" role="alert">
          <h3>{n.title}</h3>
          <p>{n.body}</p>
        </article>
      ))}
    </>
  );
}

const wants = { any: "First-timers welcome", some: "Some experience wanted", seasoned: "Seasoned hands wanted" } as const;

// Read-only ride rows: first name and boat only, never contact details.
export function RideTeasers({ club, rides }: { club: Club; rides: OfferView[] }) {
  if (rides.length === 0) return <p className="muted">No open seats right now.</p>;
  return (
    <ul className="rows">
      {rides.map(({ offer, owner, seatsLeft }) => (
        <li key={offer.id} className="ride">
          <div className="top">
            <h3><Link href={`/${club.slug}/rides#${offer.id}`}>{offer.title}</Link></h3>
            <span className="tag">{seatsLeft === 0 ? "Full" : `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} open`}</span>
          </div>
          <p className="meta muted">
            {fmtWhen(offer.departsAt, club.timezone)} with {owner.firstName}{owner.boatName ? ` aboard ${owner.boatName}` : ""}. {wants[offer.experience]}.
          </p>
        </li>
      ))}
    </ul>
  );
}
export { wants as experienceWanted };
