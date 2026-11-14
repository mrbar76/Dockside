"use client";

// The last line of defence: the whole app failed. It brings its own page.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#fff", color: "#111" }}>
        <title>Something went wrong</title>
        <main style={{ maxWidth: "34rem", margin: "4rem auto", padding: "0 1.25rem", lineHeight: 1.5 }} role="alert">
          <h1>The club site did not load</h1>
          <p>Try again in a moment.</p>
          <p><button onClick={() => retry()} style={{ minHeight: "2.75rem", padding: "0 1.2rem", fontSize: "1rem" }}>Try again</button></p>
        </main>
      </body>
    </html>
  );
}
