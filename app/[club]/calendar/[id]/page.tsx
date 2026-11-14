import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { activeMembers, eventById, fullName, signupsFor } from "@/lib/core/data";
import { fmtDay, fmtTime } from "@/lib/core/time";
import { getViewer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { cancelMySignup, signUpForEvent } from "../../actions";

export default async function Page({ params, searchParams }: PageProps<"/[club]/calendar/[id]">) {
  const { club: slug, id } = await params;
  const club = await requireClub(slug);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer(club.id);
  const { event, signups, roster } = await withClub(club.id, async (tx) => ({
    event: await eventById(tx, id),
    signups: viewer ? await signupsFor(tx, id) : [],
    roster: viewer?.isOfficer ? await activeMembers(tx) : [],
  }));
  if (!event) notFound();
  const tz = club.timezone;
  const mine = viewer ? signups.find((s) => s.member.id === viewer.member.id) : undefined;
  const total = signups.reduce((n, s) => n + s.signup.partySize, 0);
  const open = event.signup && !event.cancelledAt && event.startsAt > new Date();
  const here = `/${slug}/calendar/${id}`;
  return (
    <div className="wrap stack">
      <p><Link href={`/${slug}/calendar`}>Calendar</Link></p>
      <h1>{event.cancelledAt ? "Cancelled: " : ""}{event.title}</h1>
      <p className="lede">
        {fmtDay(event.startsAt, tz)}, {fmtTime(event.startsAt, tz)}{event.endsAt ? ` to ${fmtTime(event.endsAt, tz)}` : ""}
        {event.location ? `. ${event.location}` : ""}
      </p>
      {event.description && <p>{event.description}</p>}
      <Flash sp={await searchParams} />
      {open && !viewer && <p><Link className="btn" href={`/${slug}/sign-in?next=${encodeURIComponent(here)}`}>Sign in to sign up</Link></p>}
      {open && viewer && (
        <form className="form stack" action={signUpForEvent.bind(null, slug, id)}>
          <h2>{mine ? "Change my sign-up" : "Sign up"}</h2>
          {event.capacity != null && <p className="muted">{Math.max(0, event.capacity - total)} of {event.capacity} places left.</p>}
          {viewer.isOfficer && (
            <label className="field">
              <span>Signing up for</span>
              <select name="memberId" defaultValue="">
                <option value="">Myself</option>
                {roster.filter((m) => m.id !== viewer.member.id).map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
              </select>
              <small>Officers can sign up a member who phoned in. It is logged under your name.</small>
            </label>
          )}
          <div className="inline">
            <label className="field" style={{ width: "8rem" }}>
              <span>How many</span>
              <input name="partySize" type="number" min={1} max={20} defaultValue={mine?.signup.partySize ?? 1} inputMode="numeric" />
            </label>
            <label className="field" style={{ flex: 1, minWidth: "12rem" }}>
              <span>Note for the organizer</span>
              <input name="note" maxLength={200} defaultValue={mine?.signup.note ?? ""} />
            </label>
          </div>
          <div className="inline">
            <button className="btn go">{mine ? "Save changes" : "Sign up"}</button>
            {mine && <button className="btn quiet" formAction={cancelMySignup.bind(null, slug, id)}>Cancel my sign-up</button>}
          </div>
        </form>
      )}
      {viewer && event.signup && (
        <section className="section">
          <h2>{total === 0 ? "Nobody has signed up yet" : `${total} going`}</h2>
          <ul className="rows">
            {signups.map((s) => (
              <li key={s.signup.id}>
                {fullName(s.member)}{s.signup.partySize > 1 ? `, party of ${s.signup.partySize}` : ""}
                {s.signup.note && <span className="muted">. {s.signup.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
