"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

// Shown inside the club's own header and colours when a page fails.
export default function ClubError({ error, retry }: { error: unknown; retry: () => void }) {
  const { club } = useParams<{ club: string }>();
  const ref = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div className="wrap stack" role="alert">
      <h1>This page did not load</h1>
      <p className="lede">Nothing you entered was lost. Try again, and if it keeps happening, tell an officer.</p>
      <p className="inline">
        <button className="btn go" onClick={() => retry()}>Try again</button>
        <Link className="btn quiet" href={`/${club}/this-week`}>Go to this week</Link>
      </p>
      {ref && <p className="small muted">Reference {ref}</p>}
    </div>
  );
}
