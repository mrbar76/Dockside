import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireClub } from "@/lib/core/clubs";
import { getViewer } from "@/lib/core/viewer";
import { Flash } from "@/components/Flash";
import { demoEnter, requestCode, verifyCode } from "../actions";
import { withClub } from "@/lib/db";
import { activeMembers } from "@/lib/core/data";
import type { Member } from "@/lib/db/schema";

export const metadata = { title: "Sign in" };

export default async function Page({ params, searchParams }: PageProps<"/[club]/sign-in">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const email = one("email"), code = one("code"), next = one("next");
  if (await getViewer(club.id)) redirect(next.startsWith(`/${slug}/`) ? next : `/${slug}/this-week`);
  const demoCode = process.env.DEMO_MODE === "true" ? (await cookies()).get("demo_code")?.value : undefined;
  const step2 = !!email && (one("sent") === "1" || !!code);
  const demo = process.env.DEMO_MODE === "true" && club.settings.demo;
  const people = demo ? await withClub(club.id, (tx) => activeMembers(tx)) : [];
  const shared = new Set(people.filter((p) => people.some((q) => q.id !== p.id && q.email === p.email)).map((p) => p.email));
  const pick: { m: Member; why: string }[] = [];
  const add = (m: Member | undefined, why: string) => { if (m && !pick.some((x) => x.m.id === m.id)) pick.push({ m, why }); };
  add(people.find((p) => p.role === "officer"), "Officer|Posts notices and events, sees the officer pages");
  add(people.find((p) => p.role !== "officer" && shared.has(p.email)), "Member, couple|Two members sharing one email address");
  add(people.find((p) => p.role !== "officer" && p.boatName), "Boat owner|Offers seats on the crew board");
  add(people.find((p) => p.role !== "officer" && !p.boatName && !shared.has(p.email)), "New member, no boat|Asks for rides on the crew board");
  return (
    <div className="wrap stack" style={{ maxWidth: "30rem" }}>
      <h1>Sign in</h1>
      <Flash sp={sp} />
      {demo && !step2 && (
        <section className="form stack">
          <h2>Enter the demo</h2>
          <p className="muted">Pick a kind of member. No email or code needed. Everyone here is made up.</p>
          <div className="stack" style={{ "--gap": "0.6rem" } as React.CSSProperties}>
            {pick.map(({ m, why }) => (
              <form key={m.id} action={demoEnter.bind(null, slug, m.id)}>
                <button className="btn go" style={{ width: "100%", textAlign: "left" }}>
                  Enter as {why.split("|")[0]}
                  <span style={{ display: "block", fontWeight: 400, fontSize: "0.9rem" }}>{m.firstName} {m.lastName}. {why.split("|")[1]}</span>
                </button>
              </form>
            ))}
          </div>
          <p className="small muted">Or sign in the normal way below.</p>
        </section>
      )}
      {!step2 ? (
        <form className="form stack" action={requestCode.bind(null, slug)}>
          <p>No password. Enter the email address the club has for you and we send a 6-digit code.</p>
          <input type="hidden" name="next" value={next} />
          <label className="field"><span>Email address</span><input name="email" type="email" required autoComplete="email" inputMode="email" defaultValue={email} /></label>
          <button className="btn go">Send my code</button>
        </form>
      ) : (
        <>
          <form className="form stack" action={verifyCode.bind(null, slug)}>
            <p>If <b>{email}</b> is on the {club.shortName} roster, a 6-digit code is on its way. It works for 10 minutes.</p>
            {demoCode && !code && <p className="flash">Demonstration mode: no email is sent. Your code is {demoCode}.</p>}
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <label className="field"><span>6-digit code</span>
              <input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} defaultValue={code} style={{ fontSize: "1.6rem", letterSpacing: "0.25em" }} />
            </label>
            <button className="btn go">Sign in</button>
          </form>
          <form action={requestCode.bind(null, slug)}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="next" value={next} />
            <button className="linkish">Send a new code</button>
          </form>
        </>
      )}
      <p className="small muted">You stay signed in on this phone for 90 days. Sharing an email address with your partner is fine: you each get your own profile.</p>
    </div>
  );
}
