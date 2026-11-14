import Link from "next/link";
import { listClubs } from "@/lib/core/clubs";

export const dynamic = "force-dynamic";

// The product's own front page: pick your club. Each club below runs on the
// same core and brings its own look.
export default async function Home() {
  if (!process.env.DATABASE_URL)
    return (
      <main className="wrap stack" style={{ paddingTop: "3rem" }}>
        <h1 style={{ fontSize: "2rem" }}>Dockside is deployed. It has no database yet.</h1>
        <p>Connect a Postgres database to this project and deploy again. The demo clubs load themselves.</p>
      </main>
    );
  const clubs = await listClubs();
  return (
    <main className="wrap stack" style={{ paddingTop: "3rem" }}>
      <h1 style={{ fontSize: "2rem" }}>Find your club</h1>
      <ul className="stack">
        {clubs.map((c) => (
          <li key={c.id}>
            <Link href={`/${c.slug}`} style={{ fontSize: "1.2rem", fontWeight: 700 }}>{c.name}</Link>
            <div style={{ color: "#555" }}>{c.settings.place}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
