import Link from "next/link";
import { requireClub } from "@/lib/core/clubs";
import { fmtMoney, membershipRules } from "@/lib/core/applications";
import { Flash } from "@/components/Flash";
import { ProofPicker } from "@/components/ProofPicker";
import { submitApplication } from "../../apply-actions";

export const metadata = { title: "Apply to join" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/join/apply">) {
  const club = await requireClub((await params).club);
  const slug = club.slug;
  const r = membershipRules(club);
  const half = { flex: 1, minWidth: "11rem" } as React.CSSProperties;
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/join`}>Joining</Link></p>
      <h1>Apply to join</h1>
      <p className="lede">About five minutes. You get a link to see where your application stands.</p>
      <Flash sp={await searchParams} />
      <form className="form stack" action={submitApplication.bind(null, slug)}>
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
          <label>Leave this empty <input name="website" tabIndex={-1} autoComplete="off" /></label>
        </div>

        <fieldset className="field">
          <legend>You</legend>
          <div className="inline">
            <label className="field" style={half}><span>First name</span><input name="firstName" required maxLength={60} autoComplete="given-name" /></label>
            <label className="field" style={half}><span>Last name</span><input name="lastName" required maxLength={60} autoComplete="family-name" /></label>
          </div>
          <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="email" /></label>
          <div className="inline">
            <label className="field" style={half}><span>Phone</span><input name="phone" type="tel" required autoComplete="tel" /></label>
            <label className="field" style={half}><span>Business phone <i className="muted">optional</i></span><input name="businessPhone" type="tel" /></label>
          </div>
          <div className="inline">
            <label className="field" style={{ flex: 3, minWidth: "13rem" }}><span>Street address</span><input name="address" required autoComplete="street-address" /></label>
            <label className="field" style={{ flex: 1, minWidth: "7rem" }}><span>Zip</span><input name="zip" required inputMode="numeric" maxLength={10} autoComplete="postal-code" /></label>
          </div>
          <label className="field"><span>Occupation <i className="muted">optional</i></span><input name="occupation" maxLength={100} /></label>
        </fieldset>

        <fieldset className="field">
          <legend>Family</legend>
          <label className="field"><span>Spouse or partner <i className="muted">optional</i></span><input name="spouseName" maxLength={100} placeholder="Full name" /><small>They become a member with you and can sign in with the same email.</small></label>
          <label className="field"><span>Children <i className="muted">optional</i></span><input name="children" maxLength={300} placeholder="Name and age, e.g. Sam 9, Lily 6" /></label>
        </fieldset>

        <fieldset className="field">
          <legend>Boat <i className="muted">if you have one</i></legend>
          <div className="inline">
            <label className="field" style={half}><span>Name</span><input name="boatName" maxLength={60} /></label>
            <label className="field" style={half}><span>Type</span><input name="boatType" maxLength={40} placeholder="Sail, power, kayak…" /></label>
          </div>
          <div className="inline">
            <label className="field" style={{ width: "8rem" }}><span>Length (ft)</span><input name="boatLength" inputMode="decimal" maxLength={12} /></label>
            <label className="field" style={{ width: "8rem" }}><span>Beam (ft)</span><input name="boatBeam" inputMode="decimal" maxLength={12} /></label>
          </div>
          {r.slipNote && <p className="note">{r.slipNote}</p>}
        </fieldset>

        <fieldset className="field">
          <legend>Sponsor</legend>
          <p className="small muted">A current member who knows you. If you give their email and they are on the club&apos;s list, they can sign off online.</p>
          <div className="inline">
            <label className="field" style={half}><span>Name</span><input name="sponsorName" maxLength={100} /></label>
            <label className="field" style={half}><span>Phone</span><input name="sponsorPhone" type="tel" maxLength={40} /></label>
          </div>
          <label className="field"><span>Email <i className="muted">optional</i></span><input name="sponsorEmail" type="email" maxLength={120} /></label>
          <label className="check"><input type="checkbox" name="noSponsor" /><span>I don&apos;t know a member yet. Please put me in touch with one.</span></label>
        </fieldset>

        <fieldset className="field">
          <legend>Pitching in</legend>
          <p className="small muted">The club runs on volunteers. Tick anything you would enjoy.</p>
          <div className="checks">
            {r.committees.map((c) => <label className="check" key={c}><input type="checkbox" name="interests" value={c} /><span>{c}</span></label>)}
          </div>
          <label className="field"><span>Anything else: skills, hobbies, special interests</span><input name="interestsOther" maxLength={300} /></label>
        </fieldset>

        {r.residency && (
          <fieldset className="field">
            <legend>Residency</legend>
            <ProofPicker count={r.proofsRequired} />
            <label className="check"><input type="checkbox" name="residency" required /><span>I confirm this information is correct, and I understand that residency in {r.residency} is required to join.</span></label>
          </fieldset>
        )}

        {r.fees && (
          <section className="note stack">
            <p><b>Due with your application: {fmtMoney(r.fees.initiation + r.fees.dues)}</b> ({fmtMoney(r.fees.initiation)} initiation and {fmtMoney(r.fees.dues)} annual dues).</p>
            <p>Mail a check payable to {r.fees.payTo ?? club.shortName}{r.fees.mailTo ? ` to ${r.fees.mailTo}` : ""}. We will email you these details too.</p>
          </section>
        )}
        <button className="btn go">Send my application</button>
        <p className="small muted">What the club does with this information: <Link href={`/${slug}/privacy`}>privacy</Link>.</p>
      </form>
    </div>
  );
}
