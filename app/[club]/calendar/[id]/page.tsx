import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { activeMembers, eventById, fullName, signupsFor } from "@/lib/core/data";
import { fmtDay, fmtTime, toZonedInput } from "@/lib/core/time";
import { getViewer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { TicketFields } from "@/components/TicketFields";
import { fmtCents } from "@/lib/core/money";
import { recordPayment } from "../../pay-actions";
import { cancelMySignup, signUpForEvent } from "../../actions";
import { cancelEvent, restoreEvent, updateEvent } from "../../officer-actions";

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
  const deadlinePassed = !!event.rsvpBy && new Date() > event.rsvpBy;
  const open = event.signup && !event.cancelledAt && event.startsAt > new Date() && !deadlinePassed;
  const priced = event.prices.length > 0;
  const owedTotal = signups.reduce((n, s) => n + s.signup.amountCents, 0);
  const paidTotal = signups.filter((s) => s.signup.paidAt).reduce((n, s) => n + s.signup.amountCents, 0);
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
      {(priced || event.rsvpBy || event.membersOnly) && (
        <ul className="ticket-facts">
          {event.prices.map((t) => <li key={t.label}><b>{t.cents ? fmtCents(t.cents) : "Free"}</b> {t.label}</li>)}
          {event.rsvpBy && <li>{deadlinePassed ? "Sign-up closed" : `Sign up by ${fmtDay(event.rsvpBy, tz)}`}</li>}
          {event.membersOnly && <li>Members and their families only</li>}
        </ul>
      )}
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
          {priced ? (
            <>
              <div className="inline">
                {event.prices.map((t) => (
                  <label className="field" style={{ width: "10rem" }} key={t.label}>
                    <span>{t.label} <i className="muted">{t.cents ? fmtCents(t.cents) : "free"}</i></span>
                    <input name={`count:${t.label}`} type="number" min={0} max={20} inputMode="numeric" defaultValue={mine ? (mine.signup.counts[t.label] ?? 0) : t === event.prices[0] ? 1 : 0} />
                  </label>
                ))}
              </div>
              {mine && <p>{mine.signup.paidAt ? <><b>Paid {fmtCents(mine.signup.amountCents)}</b> by {mine.signup.paidHow}.</> : mine.signup.amountCents > 0 ? <><b>You owe {fmtCents(mine.signup.amountCents)}.</b> <Link href={`/${slug}/pay/event/${id}`}>Pay now</Link></> : null}</p>}
              <label className="field"><span>Note for the organizer</span><input name="note" maxLength={200} defaultValue={mine?.signup.note ?? ""} /></label>
            </>
          ) : (
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
          )}
          <div className="inline">
            <button className="btn go">{mine ? "Save changes" : "Sign up"}</button>
            {mine && <button className="btn quiet" formAction={cancelMySignup.bind(null, slug, id)}>Cancel my sign-up</button>}
          </div>
        </form>
      )}
      {viewer?.isOfficer && (
        <details className="officer-panel">
          <summary>Change or cancel this event</summary>
          <div className="stack">
            <form className="form stack" action={updateEvent.bind(null, slug, id)}>
              <h2>Change the details</h2>
              <label className="field"><span>Name</span><input name="title" required maxLength={90} defaultValue={event.title} /></label>
              <div className="inline">
                <label className="field" style={{ flex: 1, minWidth: "13rem" }}><span>Starts</span><input name="startsAt" type="datetime-local" required defaultValue={toZonedInput(event.startsAt, tz)} /></label>
                <label className="field" style={{ flex: 1, minWidth: "13rem" }}><span>Ends</span><input name="endsAt" type="datetime-local" defaultValue={event.endsAt ? toZonedInput(event.endsAt, tz) : ""} /></label>
              </div>
              <label className="field"><span>Where</span><input name="location" maxLength={90} defaultValue={event.location} /></label>
              <label className="field"><span>Details</span><textarea name="description" maxLength={1500} defaultValue={event.description} /></label>
              <div className="inline">
                <label className="check" style={{ flex: 1, minWidth: "12rem" }}><input type="checkbox" name="signup" defaultChecked={event.signup} /><span>Members can sign up</span></label>
                <label className="field" style={{ width: "10rem" }}><span>Places</span><input name="capacity" type="number" min={1} inputMode="numeric" placeholder="No limit" defaultValue={event.capacity ?? ""} /></label>
              </div>
              <TicketFields prices={event.prices} rsvpBy={event.rsvpBy ? toZonedInput(event.rsvpBy, tz).slice(0, 10) : ""} membersOnly={event.membersOnly} />
              <button className="btn go">Save changes</button>
            </form>
            {event.cancelledAt ? (
              <form action={restoreEvent.bind(null, slug, id)}><button className="btn">Put the event back on</button></form>
            ) : (
              <form className="form stack" action={cancelEvent.bind(null, slug, id)}>
                <h2>Cancel the event</h2>
                <label className="field"><span>Why, in a line</span><input name="reason" maxLength={200} placeholder="Small craft advisory. See you next week." /></label>
                <label className="check"><input type="checkbox" name="tell" defaultChecked /><span>Tell the {signups.length} member{signups.length === 1 ? "" : "s"} who signed up</span></label>
                <button className="btn danger">Cancel the event</button>
              </form>
            )}
          </div>
        </details>
      )}
      {viewer && event.signup && (
        <section className="section">
          <h2>{total === 0 ? "Nobody has signed up yet" : `${total} going`}</h2>
          {viewer.isOfficer && priced && total > 0 && (
            <p className="note">Collected <b>{fmtCents(paidTotal)}</b> of {fmtCents(owedTotal)}. Still owed: {fmtCents(owedTotal - paidTotal)}.</p>
          )}
          <ul className="rows">
            {signups.map((s) => (
              <li key={s.signup.id}>
                {fullName(s.member)}
                {priced ? <span className="muted">. {Object.entries(s.signup.counts).filter(([, n]) => n > 0).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(", ")}</span> : s.signup.partySize > 1 ? `, party of ${s.signup.partySize}` : ""}
                {s.signup.note && <span className="muted">. {s.signup.note}</span>}
                {viewer.isOfficer && priced && s.signup.amountCents > 0 && (
                  s.signup.paidAt
                    ? <span className="tag">Paid {fmtCents(s.signup.amountCents)} by {s.signup.paidHow}</span>
                    : (
                      <form className="inline" action={recordPayment.bind(null, slug, "event", s.signup.id, `calendar/${id}`)} style={{ marginTop: "0.3rem" }}>
                        <span className="tag warn">Owes {fmtCents(s.signup.amountCents)}</span>
                        <select name="method" aria-label="Paid by" defaultValue="check"><option value="check">Check</option><option value="cash">Cash</option></select>
                        <input name="note" placeholder="Check no." aria-label="Check number" style={{ width: "7rem" }} />
                        <button className="btn sm quiet">Record payment</button>
                      </form>
                    )
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
