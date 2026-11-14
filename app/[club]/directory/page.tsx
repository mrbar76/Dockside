import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { directory, fullName } from "@/lib/core/data";
import { requireViewer } from "@/lib/core/viewer";

export const metadata = { title: "Directory" };

export default async function Page({ params }: PageProps<"/[club]/directory">) {
  const club = await requireClub((await params).club);
  await requireViewer(club, `/${club.slug}/directory`);
  const people = await withClub(club.id, (tx) => directory(tx));
  return (
    <div className="wrap stack">
      <h1>Directory</h1>
      <p className="muted">For members only. Choose whether you are listed on the Me page.</p>
      <div className="scroll">
        <table className="people">
          <thead><tr><th>Name</th><th>Boat</th><th>Reach them</th></tr></thead>
          <tbody>
            {people.map((m) => (
              <tr key={m.id}>
                <td><b>{fullName(m)}</b>{m.title && <div className="small muted">{m.title}</div>}</td>
                <td>{m.boatName ?? ""}{m.boatType && <div className="small muted">{m.boatType === "sail" ? "Sail" : "Power"}</div>}</td>
                <td><a href={`mailto:${m.email}`}>{m.email}</a>{m.phone && <div><a href={`tel:${m.phone}`}>{m.phone}</a></div>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
