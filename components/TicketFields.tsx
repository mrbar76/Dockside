import type { Tier } from "@/lib/core/money";

// Officer form fields for a paid event. Up to three ticket types.
export function TicketFields({ prices = [], rsvpBy = "", membersOnly = false }: { prices?: Tier[]; rsvpBy?: string; membersOnly?: boolean }) {
  const rows = [0, 1, 2].map((i) => prices[i] ?? (i === 0 ? { label: "Adult", cents: -1 } : i === 1 ? { label: "Child 12 and under", cents: 0 } : { label: "", cents: -1 }));
  return (
    <fieldset className="field">
      <legend>Tickets <i className="muted">leave prices empty for a free event</i></legend>
      {rows.map((t, i) => (
        <div className="inline" key={i}>
          <label className="field" style={{ flex: 2, minWidth: "11rem" }}><span>Ticket type</span><input name={`tierLabel${i}`} maxLength={40} defaultValue={t.label} placeholder={i === 2 ? "Non-fishing guest" : ""} /></label>
          <label className="field" style={{ width: "7rem" }}><span>Price ($)</span><input name={`tierPrice${i}`} inputMode="decimal" defaultValue={t.cents >= 0 && prices.length ? String(t.cents / 100) : i === 1 ? "0" : ""} /></label>
        </div>
      ))}
      <div className="inline">
        <label className="field" style={{ width: "11rem" }}><span>Sign up by</span><input name="rsvpBy" type="date" defaultValue={rsvpBy} /></label>
        <label className="check" style={{ flex: 1, minWidth: "12rem", alignSelf: "end" }}><input type="checkbox" name="membersOnly" defaultChecked={membersOnly} /><span>Members and their families only</span></label>
      </div>
    </fieldset>
  );
}
