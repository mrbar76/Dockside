import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { getViewer } from "@/lib/core/viewer";
import { fmtCents } from "@/lib/core/money";
import { Flash } from "@/components/Flash";
import { bill, payOnline } from "../../../pay-actions";

export const metadata = { title: "Pay", robots: { index: false } };

// Checkout. In the demo it looks and works like a real checkout but moves no
// money. Live, this step opens Stripe's own checkout page instead.
export default async function Page({ params, searchParams }: PageProps<"/[club]/pay/[kind]/[id]">) {
  const { club: slug, kind, id } = await params;
  const club = await requireClub(slug);
  const viewer = await getViewer(club.id);
  const here = `/${slug}/pay/${kind}/${id}`;
  if (!viewer) redirect(`/${slug}/sign-in?next=${encodeURIComponent(here)}`);
  const b = await withClub(club.id, (tx) => bill(tx, kind, id, viewer.member.id, viewer.isOfficer));
  if (!b) notFound();
  const fees = club.settings.fees;
  const demo = !!club.settings.demo;
  const lines = Object.entries(b.counts).filter(([, n]) => n > 0).map(([l, n]) => `${n} ${l.toLowerCase()}`).join(", ");
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem", maxWidth: "34rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/${b.back}`}>Back</Link></p>
      <h1>{b.paidAt ? "Paid" : "Pay"}</h1>
      <Flash sp={await searchParams} />
      <section className="checkout stack">
        <p className="muted small">{club.name}</p>
        <p><b>{b.title}</b>{lines && <span className="muted"> ({lines})</span>}</p>
        {"late" in b && b.late && !b.paidAt && <p className="small">Includes the late fee.</p>}
        <p className="amount">{fmtCents(b.cents)}</p>
      </section>
      {b.paidAt ? (
        <p className="next-up"><b>Thank you, this is paid.</b> <Link href={`/${slug}/${b.back}`}>Back</Link></p>
      ) : b.cents > 0 && (
        <>
          {demo && <p className="note small"><b>Demo checkout.</b> No money moves. In the live version this step is Stripe&apos;s secure payment page, paid straight to the club.</p>}
          <form className="form stack" action={payOnline.bind(null, slug, kind, id)}>
            <fieldset className="field">
              <legend>Pay with</legend>
              <label className="check"><input type="radio" name="method" value="card" defaultChecked /><span>Card, Apple Pay or Google Pay</span></label>
              <label className="check"><input type="radio" name="method" value="bank" /><span>Bank account</span></label>
            </fieldset>
            {demo && (
              <div className="inline" aria-hidden="true">
                <label className="field" style={{ flex: 2, minWidth: "12rem" }}><span>Card number</span><input value="4242 4242 4242 4242" readOnly tabIndex={-1} /></label>
                <label className="field" style={{ width: "6rem" }}><span>Expires</span><input value="12/29" readOnly tabIndex={-1} /></label>
                <label className="field" style={{ width: "5rem" }}><span>CVC</span><input value="123" readOnly tabIndex={-1} /></label>
              </div>
            )}
            <button className="btn go">Pay {fmtCents(b.cents)}</button>
            <p className="small muted">No added card fee. The price is the price.</p>
          </form>
          <details className="officer-panel">
            <summary>Pay by check instead</summary>
            <p>Make the check payable to {fees?.payTo ?? club.shortName} and give it to {fees?.treasurer ?? "the Treasurer"}{fees?.mailTo ? `, or mail it to ${fees.mailTo}` : ""}. Write &ldquo;{b.title}&rdquo; on the memo line. It shows as paid once it is recorded.</p>
          </details>
        </>
      )}
    </div>
  );
}
