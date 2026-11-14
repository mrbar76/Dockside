import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { clubPage } from "@/lib/core/data";
import { TABLES } from "@/lib/core/export";
import { requireOfficer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { savePage } from "../../officer-actions";

export const metadata = { title: "Club pages" };
const KEYS = [
  { key: "home", what: "The welcome on the front page, with an optional photo." },
  { key: "about", what: "Who the club is. The first thing a neighbour reads." },
  { key: "join", what: "How to join: who can, what it costs, who to ask. Forms filed under Join in Documents show here." },
  { key: "contact", what: "How to reach the club. Email and position are added for you." },
  { key: "privacy", what: "What the club keeps about members and why. Starts as a draft for the Board to adopt." },
] as const;

export default async function Page({ params, searchParams }: PageProps<"/[club]/officers/site">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers/site`);
  const pages = await withClub(club.id, async (tx) => Promise.all(KEYS.map((k) => clubPage(tx, club, k.key))));
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers`}>Officers</Link></p>
      <h1>Club pages</h1>
      <p className="lede">Plain text. Leave a blank line between paragraphs. Start a line with a dash for a list.</p>
      <Flash sp={await searchParams} />
      {KEYS.map((k, i) => {
        const p = pages[i];
        return (
          <details key={k.key} className="officer-panel" open={i === 0}>
            <summary>{p.title}{p.isDefault ? <span className="muted small"> (starting text)</span> : null}</summary>
            <form className="form stack" action={savePage.bind(null, slug, k.key)}>
              <p className="muted small">{k.what} {k.key !== "home" && <Link href={`/${slug}/${k.key}`}>See the page</Link>}</p>
              <label className="field"><span>Title</span><input name="title" required maxLength={80} defaultValue={p.title} /></label>
              <label className="field"><span>Text</span><textarea name="body" maxLength={8000} defaultValue={p.body} style={{ minHeight: "14rem" }} /></label>
              {k.key === "home" && (
                <>
                  {"photoId" in p && p.photoId && (
                    <p><img src={`/${slug}/files/${p.photoId}`} alt="Current front page photo" style={{ maxWidth: "100%", maxHeight: "12rem" }} /></p>
                  )}
                  <label className="field"><span>Front page photo</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /><small>A JPG or PNG under 4 MB. Wide pictures of the water work best.</small></label>
                  {"photoId" in p && p.photoId && <label className="check"><input type="checkbox" name="removePhoto" /><span>Take the photo down</span></label>}
                </>
              )}
              <button className="btn go">Save {p.title}</button>
            </form>
          </details>
        );
      })}
      <section className="section stack">
        <h2>The club&apos;s data</h2>
        <p>Everything the club keeps is the club&apos;s. Download it any time, for the archive or to move elsewhere. Sign-in links and phone keys are left out.</p>
        <p><a className="btn" href={`/${slug}/officers/export/everything.json`}>Download everything</a></p>
        <ul className="rows">
          {Object.entries(TABLES).map(([k, t]) => <li key={k}><a href={`/${slug}/officers/export/${k}.csv`}>{t.label}</a> <span className="muted small">spreadsheet</span></li>)}
        </ul>
      </section>
    </div>
  );
}
