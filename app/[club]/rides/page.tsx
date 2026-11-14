import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { fullName, openOffers } from "@/lib/core/data";
import { fmtWhen } from "@/lib/core/time";
import { getViewer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { experienceWanted } from "@/components/Lists";
import { decide, offerSeat, raiseHand, withdrawOffer } from "../actions";

export const metadata = { title: "Crew and rides" };
const level = { new: "new to boats", some: "some time on the water", seasoned: "seasoned" } as const;

// Owners post an open seat. Members without a boat raise a hand. The owner,
// and only the owner, decides who comes aboard.
export default async function Page({ params, searchParams }: PageProps<"/[club]/rides">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  const here = `/${slug}/rides`;
  if (!viewer)
    return (
      <div className="wrap stack">
        <h1>Crew and rides</h1>
        <p className="lede">Boat owners post open seats here, and members without a boat ask to come along. It is open to members only.</p>
        <p><Link className="btn" href={`/${slug}/sign-in?next=${encodeURIComponent(here)}`}>Sign in to see open seats</Link></p>
      </div>
    );
  const me = viewer.member;
  const offers = await withClub(club.id, (tx) => openOffers(tx, new Date()));
  return (
    <div className="wrap stack">
      <h1>Crew and rides</h1>
      <p className="lede">Got room aboard? Post it. No boat? Raise a hand. The owner decides who comes.</p>
      <Flash sp={await searchParams} />
      {offers.length === 0 && <p className="muted">No open seats right now. Be the first to post one.</p>}
      <ul className="rows">
        {offers.map(({ offer, owner, requests, seatsLeft }) => {
          const mine = owner.id === me.id;
          const myReq = requests.find((r) => r.member.id === me.id);
          const pending = requests.filter((r) => r.req.status === "pending");
          const aboard = requests.filter((r) => r.req.status === "accepted");
          return (
            <li key={offer.id} id={offer.id} className="ride stack" style={{ "--gap": "0.5rem" } as React.CSSProperties}>
              <div className="top">
                <h3>{offer.title}</h3>
                <span className="tag">{seatsLeft === 0 ? "Full" : `${seatsLeft} of ${offer.seats} open`}</span>
              </div>
              <p className="muted">
                {fmtWhen(offer.departsAt, club.timezone)}. {mine ? "Your offer. " : ""}{offer.kind === "crew" ? "Crew wanted" : "Guests welcome"}{mine ? "" : ` by ${fullName(owner)}`}
                {owner.boatName ? ` aboard ${owner.boatName}` : ""}. {experienceWanted[offer.experience]}.
              </p>
              {offer.notes && <p>{offer.notes}</p>}
              {mine ? (
                <div className="requests stack" style={{ "--gap": "0.3rem" } as React.CSSProperties}>
                  <p><b>{pending.length ? "Hands up" : aboard.length ? "Coming aboard" : "No one has asked yet"}</b></p>
                  <ul>
                    {requests.filter((r) => r.req.status !== "declined").map((r) => (
                      <li key={r.req.id}>
                        <span>{fullName(r.member)}, {level[r.member.experience]}{r.req.note ? `. "${r.req.note}"` : ""}</span>
                        {r.req.status === "pending" ? (
                          <form className="inline">
                            <button className="btn sm go" formAction={decide.bind(null, slug, r.req.id, true)}>Accept</button>
                            <button className="btn sm quiet" formAction={decide.bind(null, slug, r.req.id, false)}>Decline</button>
                          </form>
                        ) : <span className="tag">Accepted</span>}
                      </li>
                    ))}
                  </ul>
                  <form action={withdrawOffer.bind(null, slug, offer.id)}><button className="linkish small">Withdraw this offer</button></form>
                </div>
              ) : myReq ? (
                <p><span className="tag">{myReq.req.status === "accepted" ? "You are aboard" : myReq.req.status === "declined" ? "Not this time" : "Your hand is up"}</span></p>
              ) : seatsLeft > 0 ? (
                <form className="inline" action={raiseHand.bind(null, slug, offer.id)}>
                  <label className="field" style={{ flex: 1, minWidth: "12rem" }}>
                    <span>A word to the owner</span>
                    <input name="note" maxLength={200} placeholder="Optional" />
                  </label>
                  <button className="btn go">Raise my hand</button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
      <section className="section">
        <form className="form stack" action={offerSeat.bind(null, slug)}>
          <h2>Post an open seat</h2>
          <label className="field"><span>Where to, or what for</span><input name="title" required maxLength={80} placeholder="Afternoon run to the point" /></label>
          <div className="inline">
            <label className="field" style={{ flex: 1, minWidth: "13rem" }}><span>Leaving</span><input name="departsAt" type="datetime-local" required /></label>
            <label className="field" style={{ width: "7rem" }}><span>Seats</span><input name="seats" type="number" min={1} max={12} defaultValue={1} inputMode="numeric" /></label>
          </div>
          <label className="field"><span>I am looking for</span>
            <select name="kind" defaultValue={me.boatType === "sail" ? "crew" : "ride"}>
              <option value="ride">Guests along for the ride</option>
              <option value="crew">Crew to help sail or handle lines</option>
            </select>
          </label>
          <label className="field"><span>Experience</span>
            <select name="experience" defaultValue="any">
              <option value="any">First-timers welcome</option>
              <option value="some">Some experience wanted</option>
              <option value="seasoned">Seasoned hands wanted</option>
            </select>
          </label>
          <label className="field"><span>Anything they should know</span><textarea name="notes" maxLength={400} /></label>
          <button className="btn">Post the seat</button>
        </form>
      </section>
    </div>
  );
}
