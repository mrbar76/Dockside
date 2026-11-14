import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { listGroups, noticesFor } from "@/lib/core/data";
import { addDays } from "@/lib/core/time";
import { getViewer } from "@/lib/core/viewer";
import { NoticeList, UrgentNotices } from "@/components/Lists";
import { Flash } from "@/components/Flash";
import { deleteNotice, updateNotice } from "../officer-actions";

export const metadata = { title: "News" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/news">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const { list, groups } = await withClub(club.id, async (tx) => ({
    list: await noticesFor(tx, viewer?.member ?? null, addDays(new Date(), -90), 50),
    groups: viewer?.isOfficer ? await listGroups(tx) : [],
  }));
  const slug = club.slug;
  const fresh = addDays(new Date(), -3);
  return (
    <div className="wrap stack">
      <h1>News</h1>
      <UrgentNotices notices={list.filter((n) => n.urgent && n.publishedAt > fresh)} />
      <Flash sp={await searchParams} />
      <NoticeList notices={list.filter((n) => !(n.urgent && n.publishedAt > fresh))} tz={club.timezone} />
      {viewer?.isOfficer && list.length > 0 && (
        <section className="section stack">
          <h2>Fix a notice</h2>
          <p className="muted small">Changes show on the page straight away. Messages already sent are not sent again.</p>
          {list.map((n) => (
            <details key={n.id} className="officer-panel">
              <summary>{n.title}</summary>
              <form className="form stack" action={updateNotice.bind(null, slug, n.id)}>
                <label className="field"><span>Headline</span><input name="title" required maxLength={90} defaultValue={n.title} /></label>
                <label className="field"><span>Message</span><textarea name="body" required maxLength={1500} defaultValue={n.body} /></label>
                <label className="field"><span>Who sees it</span>
                  <select name="groupId" defaultValue={n.groupId ?? ""}>
                    <option value="">All members</option>
                    {groups.map((g) => <option key={g.id} value={g.id}>{g.name} only</option>)}
                  </select>
                </label>
                <label className="check"><input type="checkbox" name="urgent" defaultChecked={n.urgent} /><span>Show as urgent</span></label>
                <div className="inline">
                  <button className="btn go">Save notice</button>
                  <button className="btn quiet" formAction={deleteNotice.bind(null, slug, n.id)} formNoValidate>Remove notice</button>
                </div>
              </form>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
