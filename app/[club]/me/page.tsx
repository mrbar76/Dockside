import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { fullName } from "@/lib/core/data";
import { origin, requireViewer } from "@/lib/core/viewer";
import { AlertsButton } from "@/components/AlertsButton";
import { Flash } from "@/components/Flash";
import { and, desc, eq, gte, inArray, isNull, gt } from "drizzle-orm";
import { withClub } from "@/lib/db";
import { dues, eventSignups, events, members } from "@/lib/db/schema";
import { duesNow, fmtCents } from "@/lib/core/money";
import { fmtDay } from "@/lib/core/time";
import { chooseProfile, forgetAlerts, resetLinks, saveChannel, saveProfile, signOut } from "../actions";

export const metadata = { title: "Me" };

const channels = [
  { v: "email", t: "Email", d: "One message a week, plus anything urgent." },
  { v: "text", t: "Text message", d: "One short text a week with a link, plus anything urgent." },
  { v: "push", t: "Alerts from the phone icon", d: "For members who added the club to their Home Screen." },
  { v: "none", t: "Nothing sent to me", d: "I will use my calendar and the sheet at the dock." },
] as const;

export default async function Page({ params, searchParams }: PageProps<"/[club]/me">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  const { member: me, profiles, isOfficer } = await requireViewer(club, `/${slug}/me`);
  const base = await origin();
  const feed = `${base.replace(/^https?:/, "webcal:")}/${slug}/cal/${me.feedToken}`;
  // Dues are billed per household, so show the household's bill to everyone in it.
  const { bill, owing } = await withClub(club.id, async (tx) => {
    const ids = me.householdId ? (await tx.select({ id: members.id }).from(members).where(eq(members.householdId, me.householdId))).map((r) => r.id) : [me.id];
    const [bill] = await tx.select().from(dues).where(inArray(dues.memberId, ids)).orderBy(desc(dues.year)).limit(1);
    const owing = await tx.select({ s: eventSignups, e: events }).from(eventSignups).innerJoin(events, eq(events.id, eventSignups.eventId))
      .where(and(eq(eventSignups.memberId, me.id), isNull(eventSignups.paidAt), gt(eventSignups.amountCents, 0), gte(events.startsAt, new Date())));
    return { bill, owing };
  });
  const billNow = bill ? duesNow(bill) : null;
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <h1>{fullName(me)}</h1>
      <Flash sp={await searchParams} />
      {(bill || owing.length > 0) && (
        <section className="form stack">
          <h2>Payments</h2>
          {bill && billNow && (
            <p className="inline" style={{ justifyContent: "space-between" }}>
              <span>
                <b>{bill.year} dues</b>{" "}
                {bill.paidAt ? <>paid {fmtDay(bill.paidAt, club.timezone)}. Thank you.</> : <>{fmtCents(billNow.owed)}, {billNow.late ? <b>past due</b> : <>due {fmtDay(bill.dueOn, club.timezone)}</>}.{bill.lateFeePct && !billNow.late ? ` ${bill.lateFeePct}% late fee after that.` : ""}</>}
              </span>
              {!bill.paidAt && <Link className="btn go" href={`/${slug}/pay/dues/${bill.id}`}>Pay dues</Link>}
            </p>
          )}
          {owing.map(({ s, e }) => (
            <p key={s.id} className="inline" style={{ justifyContent: "space-between" }}>
              <span><b>{e.title}</b> tickets, {fmtCents(s.amountCents)}</span>
              <Link className="btn quiet" href={`/${slug}/pay/event/${e.id}`}>Pay</Link>
            </p>
          ))}
        </section>
      )}
      {profiles.length > 1 && (
        <form className="form stack" action={chooseProfile.bind(null, slug)}>
          <h2>Who is using this phone?</h2>
          <p className="muted">More than one member shares this email address.</p>
          <div className="inline">
            {profiles.map((p) => (
              <button key={p.id} name="memberId" value={p.id} className={`btn ${p.id === me.id ? "" : "quiet"}`}>{p.firstName}</button>
            ))}
          </div>
        </form>
      )}
      <form className="form stack" action={saveChannel.bind(null, slug)}>
        <h2>How the club reaches me</h2>
        <div className="stack choices" role="radiogroup" aria-label="Channel">
          {channels.map((c) => (
            <label className="choice" key={c.v}>
              <input type="radio" name="channel" value={c.v} defaultChecked={me.channel === c.v} />
              <span><b>{c.t}</b><span className="muted">{c.d}</span></span>
            </label>
          ))}
        </div>
        <label className="field"><span>Mobile number</span><input name="phone" type="tel" defaultValue={me.phone ?? ""} autoComplete="tel" /><small>Needed only for text messages.</small></label>
        <label className="check"><input type="checkbox" name="consent" defaultChecked={!!me.textConsentAt} /><span>I agree to get text messages from {club.name}. About one a week. Reply STOP to end them.</span></label>
        <label className="check"><input type="checkbox" name="inDirectory" defaultChecked={me.inDirectory} /><span>List me in the member directory.</span></label>
        <button className="btn">Save</button>
      </form>
      <form className="form stack" action={saveProfile.bind(null, slug)}>
        <h2>My details</h2>
        <div className="inline">
          <label className="field" style={{ flex: 1, minWidth: "10rem" }}><span>First name</span><input name="firstName" required maxLength={60} defaultValue={me.firstName} autoComplete="given-name" /></label>
          <label className="field" style={{ flex: 1, minWidth: "10rem" }}><span>Last name</span><input name="lastName" required maxLength={60} defaultValue={me.lastName} autoComplete="family-name" /></label>
        </div>
        <div className="inline">
          <label className="field" style={{ flex: 1, minWidth: "10rem" }}><span>Boat name</span><input name="boatName" maxLength={60} defaultValue={me.boatName ?? ""} /></label>
          <label className="field" style={{ width: "10rem" }}><span>Boat type</span>
            <select name="boatType" defaultValue={me.boatType ?? ""}><option value="">No boat</option><option value="sail">Sail</option><option value="power">Power</option></select>
          </label>
        </div>
        <label className="field"><span>Time on the water</span>
          <select name="experience" defaultValue={me.experience}><option value="new">New to boats</option><option value="some">Some</option><option value="seasoned">Seasoned</option></select>
          <small>Boat owners see this when you raise a hand for a seat.</small>
        </label>
        <p className="muted small">To change your email address, ask an officer.</p>
        <button className="btn">Save my details</button>
      </form>
      <section className="form stack">
        <h2>Club events in my own calendar</h2>
        <p>Tap once and club events appear in your phone&apos;s calendar and stay up to date.</p>
        <p><a className="btn quiet" href={feed}>Add to my calendar</a></p>
      </section>
      <section className="form stack">
        <h2>Put the club on my Home Screen</h2>
        <p>iPhone: tap Share, then Add to Home Screen. Android: tap the menu, then Add to Home screen. Open the club from the new icon, come back to this page and turn alerts on.</p>
        <AlertsButton slug={slug} publicKey={process.env.VAPID_PUBLIC_KEY || null} />
        <form action={forgetAlerts.bind(null, slug)}><button className="linkish small">Turn alerts off on all my phones</button></form>
      </section>
      <section className="form stack">
        <h2>My personal link</h2>
        <p>Opens this week&apos;s page with no sign-in. It is in your weekly message. Keep it to yourself.</p>
        <p className="copy">{base}/{slug}/w/{me.linkToken}</p>
        <form action={resetLinks.bind(null, slug)}><button className="linkish small">Make new links and cancel the old ones</button></form>
      </section>
      <p className="inline">
        <Link className="btn quiet" href={`/${slug}/directory`}>Directory</Link>
        <Link className="btn quiet" href={`/${slug}/documents`}>Documents</Link>
        {isOfficer && <Link className="btn quiet" href={`/${slug}/officers`}>Officers</Link>}
      </p>
      <p className="small">What the club keeps about you, and why: <Link href={`/${slug}/privacy`}>privacy</Link>.</p>
      <form action={signOut.bind(null, slug)}><button className="linkish">Sign out</button></form>
    </div>
  );
}
