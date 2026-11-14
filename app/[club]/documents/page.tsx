import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { listDocuments } from "@/lib/core/data";
import { getViewer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { addDocument, deleteDocument } from "../officer-actions";

export const metadata = { title: "Documents" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/documents">) {
  const club = await requireClub((await params).club);
  const slug = club.slug;
  const viewer = await getViewer(club.id);
  const officer = !!viewer?.isOfficer;
  const docs = await withClub(club.id, (tx) => listDocuments(tx, !!viewer));
  const cats = [...new Set(docs.map((d) => d.category))];
  return (
    <div className="wrap stack">
      <h1>Documents</h1>
      {!viewer && <p className="muted">Members see more here after they <Link href={`/${slug}/sign-in?next=${encodeURIComponent(`/${slug}/documents`)}`}>sign in</Link>.</p>}
      <Flash sp={await searchParams} />
      {docs.length === 0 && <p className="muted">No documents yet.</p>}
      {cats.map((c) => (
        <section className="section" key={c}>
          <h2>{c}</h2>
          <ul className="rows">
            {docs.filter((d) => d.category === c).map((d) => (
              <li key={d.id} className="inline" style={{ justifyContent: "space-between" }}>
                <span><a href={d.url}>{d.title}</a>{officer && d.membersOnly && <span className="muted small"> members only</span>}</span>
                {officer && <form action={deleteDocument.bind(null, slug, d.id)}><button className="btn sm quiet" aria-label={`Remove ${d.title}`}>Remove</button></form>}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {officer && (
        <form className="form stack" action={addDocument.bind(null, slug)}>
          <h2>Add a document</h2>
          <label className="field"><span>Title</span><input name="title" required maxLength={90} placeholder="2027 slip rates" /></label>
          <label className="field"><span>Shelf</span>
            <input name="category" maxLength={40} list="shelves" placeholder="General" />
            <datalist id="shelves">{[...new Set([...cats, "Bylaws", "Minutes", "Forms", "Join", "Race instructions"])].map((c) => <option key={c} value={c} />)}</datalist>
            <small>File it under Join and it also shows on the Joining page.</small>
          </label>
          <label className="field"><span>File</span><input name="file" type="file" accept=".pdf,.docx,.xlsx,.txt,image/jpeg,image/png,image/webp" /><small>PDF, Word, Excel or a picture, up to 4 MB.</small></label>
          <label className="field"><span>Or a link</span><input name="link" type="url" placeholder="https://" /><small>For anything bigger, share it from Google Drive or Dropbox and paste the link.</small></label>
          <label className="check"><input type="checkbox" name="membersOnly" defaultChecked /><span>Members only</span></label>
          <button className="btn go">Add document</button>
        </form>
      )}
    </div>
  );
}
