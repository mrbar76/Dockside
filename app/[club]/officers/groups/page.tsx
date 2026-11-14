import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { fullName, listGroups } from "@/lib/core/data";
import { groupMembers, members } from "@/lib/db/schema";
import { requireOfficer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { deleteGroup, removeFromGroup, saveGroup } from "../../officer-actions";

export const metadata = { title: "Groups" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/officers/groups">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers/groups`);
  const { groups, rows } = await withClub(club.id, async (tx) => ({
    groups: await listGroups(tx),
    rows: await tx.select({ g: groupMembers.groupId, m: members }).from(groupMembers).innerJoin(members, eq(members.id, groupMembers.memberId)).orderBy(asc(members.lastName)),
  }));
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers`}>Officers</Link></p>
      <h1>Groups</h1>
      <p className="lede">A group gets notices meant only for them: race committee, the work party, slip holders on C dock.</p>
      <Flash sp={await searchParams} />
      {groups.length === 0 && <p className="muted">No groups yet.</p>}
      {groups.map((g) => {
        const people = rows.filter((r) => r.g === g.id);
        return (
          <section className="section stack" key={g.id}>
            <h2>{g.name} <span className="muted small">{people.length} {people.length === 1 ? "person" : "people"}</span></h2>
            {people.length > 0 && (
              <ul className="rows">
                {people.map(({ m }) => (
                  <li key={m.id} className="inline" style={{ justifyContent: "space-between" }}>
                    <Link href={`/${slug}/officers/members/${m.id}`}>{fullName(m)}</Link>
                    <form action={removeFromGroup.bind(null, slug, g.id, m.id)}><button className="btn sm quiet" aria-label={`Remove ${fullName(m)} from ${g.name}`}>Remove</button></form>
                  </li>
                ))}
              </ul>
            )}
            <details className="officer-panel">
              <summary>Rename or remove {g.name}</summary>
              <form className="inline" action={saveGroup.bind(null, slug, g.id)}>
                <label className="field" style={{ flex: 1, minWidth: "12rem" }}><span>Name</span><input name="name" required maxLength={60} defaultValue={g.name} /></label>
                <button className="btn">Rename</button>
                <button className="btn quiet" formAction={deleteGroup.bind(null, slug, g.id)} formNoValidate>Remove group</button>
              </form>
            </details>
          </section>
        );
      })}
      <form className="form inline" action={saveGroup.bind(null, slug, "new")}>
        <label className="field" style={{ flex: 1, minWidth: "12rem" }}><span>New group</span><input name="name" required maxLength={60} placeholder="Race committee" /></label>
        <button className="btn go">Add group</button>
      </form>
      <p className="muted small">To put someone in a group, open them from the <Link href={`/${slug}/officers/roster`}>roster</Link>.</p>
    </div>
  );
}
