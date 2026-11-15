import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { applications } from "@/lib/db/schema";
import { STEPS, fmtMoney, membershipRules, stageOf } from "@/lib/core/applications";
import { fmtDay } from "@/lib/core/time";
import { Flash } from "@/components/Flash";
import { withdrawApplication } from "../../../apply-actions";

export const metadata = { title: "Your application", robots: { index: false } };

// The applicant's private page. Anyone with the link sees the stage, never the
// details or the proofs.
export default async function Page({ params, searchParams }: PageProps<"/[club]/join/status/[token]">) {
  const { club: slug, token } = await params;
  const club = await requireClub(slug);
  if (!/^[\w-]{16,}$/.test(token)) notFound();
  const [a] = await withClub(club.id, (tx) => tx.select().from(applications).where(eq(applications.statusToken, token)).limit(1));
  if (!a) notFound();
  const r = membershipRules(club);
  const tz = club.timezone;
  const rows = [
    { label: r.sponsorRequired ? "Sponsor signed off" : null, at: a.sponsoredAt },
    { label: r.fees ? `Check received (${fmtMoney(r.fees.initiation + r.fees.dues)})` : null, at: a.paidAt },
    ...STEPS.map((s) => ({ label: s.label, at: a[s.key] })),
  ].filter((x) => x.label);
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <h1>Your application</h1>
      <Flash sp={await searchParams} />
      <p className="lede">{a.firstName} {a.lastName}, sent {fmtDay(a.createdAt, tz)}.</p>
      <p className="next-up"><b>{stageOf(a)}</b></p>
      <ol className="steps">
        {rows.map((x) => (
          <li key={x.label} className={x.at ? "done" : ""}>
            <span>{x.label}</span>
            <span className="muted small">{x.at ? fmtDay(x.at, tz) : "Not yet"}</span>
          </li>
        ))}
      </ol>
      {a.status === "open" && r.fees && !a.paidAt && (
        <p className="note">Mail a check for {fmtMoney(r.fees.initiation + r.fees.dues)} payable to {r.fees.payTo ?? club.shortName}{r.fees.mailTo ? ` to ${r.fees.mailTo}` : ""}.</p>
      )}
      <p>Questions? Write to {club.settings.contactEmail ? <a href={`mailto:${club.settings.contactEmail}`}>{club.settings.contactEmail}</a> : "the club"}.</p>
      {a.status === "open" && (
        <details className="officer-panel">
          <summary>Withdraw my application</summary>
          <form action={withdrawApplication.bind(null, slug, token)}>
            <p className="small">This deletes your proofs of residency. You can apply again later.</p>
            <button className="btn quiet">Withdraw</button>
          </form>
        </details>
      )}
    </div>
  );
}
