import Link from "next/link";

export default function NotFound() {
  return (
    <main className="wrap stack" style={{ paddingTop: "3rem" }}>
      <h1 style={{ fontSize: "2rem" }}>That page is not here</h1>
      <p>The link may be old, or a personal link may have been replaced with a new one.</p>
      <p><Link href="/">Find your club</Link></p>
    </main>
  );
}
