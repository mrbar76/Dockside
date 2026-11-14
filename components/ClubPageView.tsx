import Link from "next/link";
import type { Club } from "@/lib/db/schema";
import { Prose } from "./Prose";

export function ClubPageView({ club, page, canEdit, children }: {
  club: Club; page: { title: string; body: string; isDefault: boolean }; canEdit: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <h1>{page.title}</h1>
      {canEdit && (
        <p className="small muted">
          {page.isDefault ? "This is starting text. " : ""}<Link href={`/${club.slug}/officers/site`}>Edit this page</Link>
        </p>
      )}
      <Prose text={page.body} />
      {children}
    </div>
  );
}
