import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { allMembers, fullName } from "@/lib/core/data";
import { requireOfficer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { importRosterAction } from "../../actions";

export const metadata = { title: "Roster" };
const how = { email: "Email", text: "Text", push: "Phone alerts", none: "Nothing sent" } as const;

export default async function Page({ params, searchParams }: PageProps<"/[club]/officers/roster">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers/roster`);
  const everyone = await withClub(club.id, (tx) => allMembers(tx));
  const people = everyone.filter((m) => m.active), gone = everyone.filter((m) => !m.active);
  const count = (c: string) => people.filter((p) => p.channel === c).length;
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers`}>Officers</Link></p>
      <h1>Roster</h1>
      <p className="lede">{people.length} members. {count("email")} by email, {count("text")} by text, {count("push")} by phone alerts, {count("none")} calendar only.</p>
      <Flash sp={await searchParams} />
      <p className="inline">
        <Link className="btn go" href={`/${slug}/officers/members/new`}>Add a member</Link>
        <Link className="btn quiet" href={`/${slug}/officers/groups`}>Groups</Link>
        <a className="btn quiet" href={`/${slug}/officers/export/members.csv`}>Download the roster</a>
      </p>
      <div className="scroll" tabIndex={0} role="region" aria-label="Roster table, scrolls sideways">
        <table className="people">
          <thead><tr><th>Name</th><th>Email</th><th>Boat</th><th>Hears by</th></tr></thead>
          <tbody>
            {people.map((m) => (
              <tr key={m.id}>
                <td><Link href={`/${slug}/officers/members/${m.id}`}><b>{fullName(m)}</b></Link>{m.role === "officer" && <div className="small muted">{m.title ?? "Officer"}</div>}</td>
                <td className="small">{m.email}</td>
                <td>{m.boatName ?? ""}</td>
                <td>{how[m.channel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gone.length > 0 && (
        <details className="officer-panel">
          <summary>{gone.length} former member{gone.length === 1 ? "" : "s"}</summary>
          <ul className="rows">{gone.map((m) => <li key={m.id}><Link href={`/${slug}/officers/members/${m.id}`}>{fullName(m)}</Link></li>)}</ul>
        </details>
      )}
      <form className="form stack" action={importRosterAction.bind(null, slug)}>
        <h2>Add members from a spreadsheet</h2>
        <p>Save the sheet as CSV and paste it here. The first row names the columns: first, last, email, phone, boat, boat type. Members already listed are updated, not doubled.</p>
        <label className="field"><span>Pasted rows</span><textarea name="csv" required style={{ minHeight: "10rem", fontSize: "0.9rem" }} placeholder={"first,last,email,phone,boat,boat type\nSam,Rivera,sam@example.com,203-555-0100,Osprey,sail"} /></label>
        <button className="btn">Add to roster</button>
      </form>
    </div>
  );
}
