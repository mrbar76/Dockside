import Link from "next/link";
import { TicketFields } from "@/components/TicketFields";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { fullName, listGroups, recentDeliveries } from "@/lib/core/data";
import { fmtWhen } from "@/lib/core/time";
import { requireOfficer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { postEvent, postNotice, sendWeeklyNow } from "../actions";

export const metadata = { title: "Officers" };
const said = { sent: "Sent", logged: "Logged (demo)", failed: "Failed", skipped: "Not sent" } as const;

export default async function Page({ params, searchParams }: PageProps<"/[club]/officers">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers`);
  const { groups, log } = await withClub(club.id, async (tx) => ({ groups: await listGroups(tx), log: await recentDeliveries(tx, 25) }));
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <h1>Officers</h1>
      <p className="lede">Write it once. It goes to the page, the calendar, the dock sheet and each member&apos;s chosen channel.</p>
      <Flash sp={await searchParams} />
      <p className="inline">
        <Link className="btn quiet" href={`/${slug}/officers/roster`}>Roster</Link>
        <Link className="btn quiet" href={`/${slug}/officers/money`}>Money</Link>
        <Link className="btn quiet" href={`/${slug}/officers/applications`}>Applications</Link>
        <Link className="btn quiet" href={`/${slug}/officers/groups`}>Groups</Link>
        <Link className="btn quiet" href={`/${slug}/officers/site`}>Club pages and data</Link>
        <Link className="btn quiet" href={`/${slug}/officers/sheet`}>Print the weekly sheet</Link>
      </p>
      <form className="form stack" action={postNotice.bind(null, slug)}>
        <h2>Post a notice</h2>
        <label className="field"><span>Headline</span><input name="title" required maxLength={90} /><small>Keep it short. This is the whole text message.</small></label>
        <label className="field"><span>Message</span><textarea name="body" required maxLength={1500} /></label>
        <label className="field"><span>Who sees it</span>
          <select name="groupId" defaultValue="">
            <option value="">All members</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} only</option>)}
          </select>
        </label>
        <label className="check"><input type="checkbox" name="urgent" /><span><b>Urgent: send it now.</b> Leave unticked and it waits for the weekly message.</span></label>
        <button className="btn go">Post notice</button>
      </form>
      <form className="form stack" action={postEvent.bind(null, slug)}>
        <h2>Add an event</h2>
        <label className="field"><span>Name</span><input name="title" required maxLength={90} /></label>
        <div className="inline">
          <label className="field" style={{ flex: 1, minWidth: "13rem" }}><span>Starts</span><input name="startsAt" type="datetime-local" required /></label>
          <label className="field" style={{ flex: 1, minWidth: "13rem" }}><span>Ends</span><input name="endsAt" type="datetime-local" /></label>
        </div>
        <label className="field"><span>Where</span><input name="location" maxLength={90} /></label>
        <label className="field"><span>Details</span><textarea name="description" maxLength={1500} /></label>
        <div className="inline">
          <label className="check" style={{ flex: 1, minWidth: "12rem" }}><input type="checkbox" name="signup" defaultChecked /><span>Members can sign up</span></label>
          <label className="field" style={{ width: "10rem" }}><span>Places</span><input name="capacity" type="number" min={1} inputMode="numeric" placeholder="No limit" /></label>
        </div>
        <TicketFields />
        <button className="btn go">Add event</button>
      </form>
      <section className="section">
        <h2>What went out</h2>
        <form action={sendWeeklyNow.bind(null, slug)} style={{ marginBottom: "1rem" }}><button className="btn quiet sm">Send the weekly message now</button></form>
        {log.length === 0 ? <p className="muted">Nothing has been sent yet.</p> : (
          <div className="scroll" tabIndex={0} role="region" aria-label="Messages sent, scrolls sideways">
            <table className="people">
              <thead><tr><th>When</th><th>To</th><th>What</th><th>How</th><th>Result</th></tr></thead>
              <tbody>
                {log.map(({ d, member, notice }) => (
                  <tr key={d.id}>
                    <td className="small">{fmtWhen(d.createdAt, club.timezone)}</td>
                    <td>{member ? fullName(member) : d.kind === "application" ? "Applicant" : ""}</td>
                    <td>{d.kind === "weekly" ? "Weekly message" : d.kind === "signin" ? "Sign-in code" : d.kind === "ride" ? "Crew board" : d.kind === "event" ? "Event change" : d.kind === "application" ? (d.detail.match(/"([^"]+)"/)?.[1] ?? "Membership application") : notice?.title ?? "Notice"}</td>
                    <td>{d.channel}</td>
                    <td>{said[d.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
