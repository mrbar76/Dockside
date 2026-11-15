import Link from "next/link";
import { asc, desc, eq, gte, inArray } from "drizzle-orm";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { dues, eventSignups, events, households, members, payments } from "@/lib/db/schema";
import { requireOfficer } from "@/lib/core/viewer";
import { fullName } from "@/lib/core/data";
import { duesNow, fmtCents } from "@/lib/core/money";
import { fmtDay, fmtDayShort } from "@/lib/core/time";
import { Flash } from "@/components/Flash";
import { billDues, recordPayment, remindDues } from "../../pay-actions";

export const metadata = { title: "Money" };

// The Treasurer's page: dues for the year, ticket money by event, every payment.
export default async function Page({ params, searchParams }: PageProps<"/[club]/officers/money">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers/money`);
  const sp = await searchParams;
  const now = new Date();
  const data = await withClub(club.id, async (tx) => {
    const years = (await tx.selectDistinct({ y: dues.year }).from(dues).orderBy(desc(dues.year))).map((r) => r.y);
    const year = Number(sp.year) || years[0] || now.getFullYear() + 1;
    const bills = await tx.select({ d: dues, m: members, h: households }).from(dues).innerJoin(members, eq(members.id, dues.memberId))
      .leftJoin(households, eq(households.id, members.householdId)).where(eq(dues.year, year)).orderBy(asc(members.lastName));
    const ledger = await tx.select({ p: payments, m: members }).from(payments).leftJoin(members, eq(members.id, payments.memberId)).orderBy(desc(payments.createdAt)).limit(40);
    const evs = await tx.select().from(events).where(gte(events.startsAt, new Date(now.getTime() - 60 * 86400000))).orderBy(asc(events.startsAt));
    const paidEvents = evs.filter((e) => e.prices.length);
    const sign = paidEvents.length ? await tx.select().from(eventSignups).where(inArray(eventSignups.eventId, paidEvents.map((e) => e.id))) : [];
    return { years, year, bills, ledger, paidEvents, sign };
  });
  const { year, bills, ledger, paidEvents, sign } = data;
  const rows = bills.map((b) => ({ ...b, now: duesNow(b.d, now) }));
  const paid = rows.filter((r) => r.d.paidAt), open = rows.filter((r) => !r.d.paidAt);
  const collected = paid.reduce((n, r) => n + (r.d.paidCents ?? r.d.amountCents), 0);
  const outstanding = open.reduce((n, r) => n + r.now.owed, 0);
  const fees = ledger.reduce((n, r) => n + r.p.feeCents, 0);
  const dueOn = rows[0]?.d.dueOn;
  return (
    <div className="wrap stack" style={{ "--gap": "1.25rem" } as React.CSSProperties}>
      <p><Link href={`/${slug}/officers`}>Officers</Link></p>
      <h1>Money</h1>
      <Flash sp={sp} />
      {club.settings.demo && <p className="note small"><b>Demo.</b> Card and bank payments here are pretend. Live, they are paid through Stripe straight into the club&apos;s bank account, and checks are recorded here by the Treasurer.</p>}

      <section className="section stack">
        <h2>{year} dues</h2>
        {rows.length === 0 ? (
          <form className="inline" action={billDues.bind(null, slug)}>
            <input type="hidden" name="year" value={year} />
            <p style={{ flex: 1 }}>No {year} bills yet. One bill per household, at {fmtCents(Math.round((club.settings.fees?.dues ?? 0) * 100))}.</p>
            <button className="btn go">Bill {year} dues</button>
          </form>
        ) : (
          <>
            <div className="stats">
              <p><b>{paid.length}</b> of {rows.length} paid</p>
              <p><b>{fmtCents(collected)}</b> collected</p>
              <p><b>{fmtCents(outstanding)}</b> still owed</p>
              {dueOn && <p>Due {fmtDay(dueOn, club.timezone)}{rows[0].d.lateFeePct ? `, ${rows[0].d.lateFeePct}% late fee after` : ""}</p>}
            </div>
            {open.length > 0 && <form action={remindDues.bind(null, slug, year)}><button className="btn quiet">Remind the {open.length} who owe</button></form>}
            <div className="scroll" tabIndex={0} role="region" aria-label="Dues by household, scrolls sideways">
              <table className="people">
                <thead><tr><th>Household</th><th>Status</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.d.id}>
                      <td><Link href={`/${slug}/officers/members/${r.m.id}`}>{r.h?.name ?? fullName(r.m)}</Link></td>
                      <td>{r.d.paidAt ? `Paid ${fmtDayShort(r.d.paidAt, club.timezone)}, ${r.d.paidHow}` : r.now.status === "lapsed" ? "Lapsed" : r.now.late ? "Late" : "Not yet"}</td>
                      <td>{fmtCents(r.d.paidAt ? r.d.paidCents ?? r.d.amountCents : r.now.owed)}</td>
                      <td>
                        {!r.d.paidAt && (
                          <form className="inline" action={recordPayment.bind(null, slug, "dues", r.d.id, `officers/money?year=${year}`)}>
                            <input name="note" placeholder="Check no." aria-label={`Check number for ${fullName(r.m)}`} style={{ width: "6.5rem" }} />
                            <input type="hidden" name="method" value="check" />
                            <button className="btn sm quiet">Check in</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {paidEvents.length > 0 && (
        <section className="section stack">
          <h2>Tickets</h2>
          <ul className="rows">
            {paidEvents.map((e) => {
              const s = sign.filter((x) => x.eventId === e.id);
              const owed = s.reduce((n, x) => n + x.amountCents, 0), got = s.filter((x) => x.paidAt).reduce((n, x) => n + x.amountCents, 0);
              return (
                <li key={e.id}>
                  <Link href={`/${slug}/calendar/${e.id}`}><b>{e.title}</b></Link> <span className="muted small">{fmtDay(e.startsAt, club.timezone)}</span>
                  <div className="small">{s.reduce((n, x) => n + x.partySize, 0)} people. Collected {fmtCents(got)}{owed > got ? `, ${fmtCents(owed - got)} still owed` : ""}.</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="section stack">
        <h2>Payments</h2>
        {ledger.length === 0 ? <p className="muted">None yet.</p> : (
          <div className="scroll" tabIndex={0} role="region" aria-label="Payments, scrolls sideways">
            <table className="people">
              <thead><tr><th>When</th><th>Who</th><th>For</th><th>How</th><th>Amount</th></tr></thead>
              <tbody>
                {ledger.map(({ p, m }) => (
                  <tr key={p.id}>
                    <td className="small">{fmtDayShort(p.createdAt, club.timezone)}</td>
                    <td>{m ? fullName(m) : ""}</td>
                    <td>{p.description}{p.note ? <span className="muted"> ({p.note})</span> : null}</td>
                    <td>{p.method}{p.demo ? " (demo)" : ""}</td>
                    <td>{fmtCents(p.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {fees > 0 && <p className="small muted">Processing fees on these online payments would be about {fmtCents(fees)} at Stripe&apos;s standard rates (2.9% + 30¢ card, 0.8% bank). The club absorbs them; Connecticut does not allow card surcharges.</p>}
        <p className="small"><a href={`/${slug}/officers/export/payments.csv`}>Download payments</a> <a href={`/${slug}/officers/export/dues.csv`}>Download dues</a></p>
      </section>
    </div>
  );
}
