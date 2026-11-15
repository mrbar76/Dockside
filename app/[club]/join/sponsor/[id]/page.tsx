import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { getViewer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { sponsorApplication } from "../../../apply-actions";

export const metadata = { title: "Sponsor a new member", robots: { index: false } };

export default async function Page({ params, searchParams }: PageProps<"/[club]/join/sponsor/[id]">) {
  const { club: slug, id } = await params;
  const club = await requireClub(slug);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await getViewer(club.id);
  const path = `/${slug}/join/sponsor/${id}`;
  if (!viewer) {
    return (
      <div className="wrap stack">
        <h1>Sponsor a new member</h1>
        <p>Sign in first, so the club knows the sign-off is yours.</p>
        <p><Link className="btn go" href={`/${slug}/sign-in?next=${encodeURIComponent(path)}`}>Sign in</Link></p>
      </div>
    );
  }
  const [a] = await withClub(club.id, (tx) => tx.select().from(applications).where(eq(applications.id, id)).limit(1));
  if (!a) notFound();
  const mine = a.sponsorId === viewer.member.id;
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <h1>Sponsor {a.firstName} {a.lastName}</h1>
      <Flash sp={await searchParams} />
      {a.status !== "open" ? <p>This application is already decided.</p>
        : mine ? <p className="next-up"><b>You are on record as sponsor.</b> Thank you.</p>
        : a.sponsoredAt ? <p>{a.sponsorName} has already signed off as sponsor.</p>
        : (
          <form className="stack" action={sponsorApplication.bind(null, slug, id)}>
            <p>{a.firstName} named you as their sponsor. By signing off you tell the Membership Committee you know them and support their application.</p>
            <p><button className="btn go">I sponsor {a.firstName}</button></p>
            <p className="small muted">Not sure? Leave this, and contact the Membership Committee.</p>
          </form>
        )}
    </div>
  );
}
