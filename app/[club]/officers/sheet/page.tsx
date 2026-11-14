import QRCode from "qrcode";
import { requireClub } from "@/lib/core/clubs";
import { withClub } from "@/lib/db";
import { thisWeek } from "@/lib/core/data";
import { getTides } from "@/lib/core/tides";
import { addDays, fmtDayShort, fmtTime, fmtWhen } from "@/lib/core/time";
import { origin, requireOfficer } from "@/lib/core/viewer";

export const metadata = { title: "Weekly sheet" };

// One printed page for the clubhouse board and the gate, for members who use
// neither phone nor email. The QR code opens the public this-week page.
export default async function Page({ params }: PageProps<"/[club]/officers/sheet">) {
  const slug = (await params).club;
  const club = await requireClub(slug);
  await requireOfficer(club, `/${slug}/officers/sheet`);
  const now = new Date();
  const tz = club.timezone;
  const [data, tides] = await Promise.all([withClub(club.id, (tx) => thisWeek(tx, null, now)), getTides(club.settings.noaaStation, now)]);
  const url = `${await origin()}/${slug}/this-week`;
  const qr = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  const high = tides.filter((t) => t.high && t.at > now).slice(0, 6);
  return (
    <div className="wrap stack sheet" style={{ "--gap": "1.1rem", padding: "1.5rem" } as React.CSSProperties}>
      <p className="no-print flash">Print this page (Ctrl or Command and P) and pin it up.</p>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "2.2rem" }}>This week at {club.shortName}</h1>
          <p>{fmtDayShort(now, tz)} to {fmtDayShort(addDays(now, 7), tz)}</p>
        </div>
        <div className="qr small" style={{ textAlign: "center" }}>
          <div dangerouslySetInnerHTML={{ __html: qr }} />
          Point your phone camera here
        </div>
      </div>
      {data.notices.filter((n) => n.urgent).map((n) => (
        <p key={n.id} style={{ border: "3px solid #000", padding: "0.6rem 0.8rem" }}><b>{n.title}.</b> {n.body}</p>
      ))}
      <section>
        <h2>On the calendar</h2>
        <ul className="rows">
          {data.events.map((e) => <li key={e.id}><b>{fmtWhen(e.startsAt, tz)}</b>. {e.title}{e.location ? `, ${e.location}` : ""}</li>)}
          {data.events.length === 0 && <li>Nothing scheduled.</li>}
        </ul>
      </section>
      <section>
        <h2>News</h2>
        <ul className="rows">{data.notices.filter((n) => !n.urgent).map((n) => <li key={n.id}><b>{n.title}.</b> {n.body}</li>)}</ul>
      </section>
      <section>
        <h2>Open seats</h2>
        <p>{data.rides.length === 0 ? "None posted." : `${data.rides.length} posted. Members can see them after signing in, or ask at the clubhouse.`}</p>
      </section>
      {high.length > 0 && (
        <section>
          <h2>High water</h2>
          <p>{high.map((t) => `${fmtDayShort(t.at, tz)} ${fmtTime(t.at, tz)} (${t.ft.toFixed(1)} ft)`).join("; ")}</p>
        </section>
      )}
    </div>
  );
}
