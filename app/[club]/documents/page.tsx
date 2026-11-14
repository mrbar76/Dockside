import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { listDocuments } from "@/lib/core/data";
import { getViewer } from "@/lib/core/viewer";

export const metadata = { title: "Documents" };

export default async function Page({ params }: PageProps<"/[club]/documents">) {
  const club = await requireClub((await params).club);
  const viewer = await getViewer(club.id);
  const docs = await withClub(club.id, (tx) => listDocuments(tx, !!viewer));
  const cats = [...new Set(docs.map((d) => d.category))];
  return (
    <div className="wrap stack">
      <h1>Documents</h1>
      {!viewer && <p className="muted">Members see more here after they <Link href={`/${club.slug}/sign-in?next=${encodeURIComponent(`/${club.slug}/documents`)}`}>sign in</Link>.</p>}
      {cats.map((c) => (
        <section className="section" key={c}>
          <h2>{c}</h2>
          <ul className="rows">{docs.filter((d) => d.category === c).map((d) => <li key={d.id}><a href={d.url}>{d.title}</a></li>)}</ul>
        </section>
      ))}
    </div>
  );
}
