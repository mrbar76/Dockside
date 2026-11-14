import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { fullName, listGroups } from "@/lib/core/data";
import { groupMembers, members } from "@/lib/db/schema";
import { requireOfficer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { saveMember } from "../../../officer-actions";

export const metadata = { title: "Member" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/officers/members/[id]">) {
  const { club: slug, id } = await params;
  const club = await requireClub(slug);
  const isNew = id === "new";
  if (!isNew && !/^[0-9a-f-]{36}$/.test(id)) notFound();
  await requireOfficer(club, `/${slug}/officers/members/${id}`);
  const { m, groups, mine } = await withClub(club.id, async (tx) => ({
    m: isNew ? undefined : (await tx.select().from(members).where(eq(members.id, id)).limit(1))[0],
    groups: await listGroups(tx),
    mine: isNew ? [] : (await tx.select({ g: groupMembers.groupId }).from(groupMembers).where(eq(groupMembers.memberId, id))).map((r) => r.g),
  }));
  if (!isNew && !m) notFound();
  const inGroup = new Set(mine);
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers/roster`}>Roster</Link></p>
      <h1>{m ? fullName(m) : "Add a member"}</h1>
      <Flash sp={await searchParams} />
      <form className="form stack" action={saveMember.bind(null, slug, id)}>
        <div className="inline">
          <label className="field" style={{ flex: 1, minWidth: "10rem" }}><span>First name</span><input name="firstName" required maxLength={60} defaultValue={m?.firstName} autoComplete="off" /></label>
          <label className="field" style={{ flex: 1, minWidth: "10rem" }}><span>Last name</span><input name="lastName" required maxLength={60} defaultValue={m?.lastName} autoComplete="off" /></label>
        </div>
        <label className="field"><span>Email</span><input name="email" type="email" required defaultValue={m?.email} autoComplete="off" /><small>A couple can share one address. Each signs in with it and picks their own name.</small></label>
        <label className="field"><span>Mobile</span><input name="phone" type="tel" defaultValue={m?.phone ?? ""} autoComplete="off" /></label>
        <div className="inline">
          <label className="field" style={{ flex: 1, minWidth: "10rem" }}><span>Boat name</span><input name="boatName" maxLength={60} defaultValue={m?.boatName ?? ""} /></label>
          <label className="field" style={{ width: "10rem" }}><span>Boat type</span>
            <select name="boatType" defaultValue={m?.boatType ?? ""}><option value="">No boat</option><option value="sail">Sail</option><option value="power">Power</option></select>
          </label>
        </div>
        <label className="field"><span>Time on the water</span>
          <select name="experience" defaultValue={m?.experience ?? "some"}><option value="new">New to boats</option><option value="some">Some</option><option value="seasoned">Seasoned</option></select>
        </label>
        <fieldset className="field">
          <legend>Role</legend>
          <div className="inline">
            <label className="field" style={{ width: "10rem" }}><span>Access</span>
              <select name="role" defaultValue={m?.role ?? "member"}><option value="member">Member</option><option value="officer">Officer</option></select>
            </label>
            <label className="field" style={{ flex: 1, minWidth: "12rem" }}><span>Title</span><input name="title" maxLength={60} defaultValue={m?.title ?? ""} placeholder="Fleet Captain" /></label>
          </div>
          <small>Officers can post notices, change events, see the roster and edit club pages.</small>
        </fieldset>
        {groups.length > 0 && (
          <fieldset className="field">
            <legend>Groups</legend>
            {groups.map((g) => (
              <label className="check" key={g.id}><input type="checkbox" name="groups" value={g.id} defaultChecked={inGroup.has(g.id)} /><span>{g.name}</span></label>
            ))}
            <small><Link href={`/${slug}/officers/groups`}>Add or rename groups</Link></small>
          </fieldset>
        )}
        {m && (
          <label className="check"><input type="checkbox" name="active" defaultChecked={m.active} /><span>Active member. Untick when someone leaves the club. Their history stays, they stop getting messages.</span></label>
        )}
        <button className="btn go">{isNew ? "Add to roster" : "Save"}</button>
      </form>
    </div>
  );
}
