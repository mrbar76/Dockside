"use client";

// A club's header itself failed to load. Plain page, no club colours.
export default function RootError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main style={{ maxWidth: "34rem", margin: "4rem auto", padding: "0 1.25rem", lineHeight: 1.5 }} role="alert">
      <h1>This page did not load</h1>
      <p>Try again in a moment. If it keeps happening, the club&apos;s officers can reach the people who run the site.</p>
      <p><button onClick={() => retry()} style={{ minHeight: "2.75rem", padding: "0 1.2rem", fontSize: "1rem" }}>Try again</button></p>
    </main>
  );
}
