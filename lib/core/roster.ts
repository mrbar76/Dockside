// Roster import from a spreadsheet saved as CSV. Expected header row:
// first,last,email,phone,boat,boat type
import { and, eq } from "drizzle-orm";
import type { Tx } from "../db";
import { members } from "../db/schema";
import { newToken } from "./data";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell.trim()); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

export async function importRoster(tx: Tx, csv: string) {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error("Paste the header row and at least one member.");
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (name: string) => head.findIndex((h) => h === name || h.startsWith(name));
  const ix = { first: col("first"), last: col("last"), email: col("email"), phone: col("phone"), boat: head.indexOf("boat"), type: col("boat type") };
  if (ix.first < 0 || ix.last < 0 || ix.email < 0) throw new Error("The header row needs first, last and email columns.");
  let added = 0, updated = 0;
  const skipped: string[] = [];
  for (const r of rows.slice(1)) {
    const firstName = r[ix.first] ?? "", lastName = r[ix.last] ?? "", email = (r[ix.email] ?? "").toLowerCase();
    if (!firstName || !lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { skipped.push(r.join(", ")); continue; }
    const t = (r[ix.type] ?? "").toLowerCase();
    const extra = {
      phone: ix.phone >= 0 ? r[ix.phone] || null : null,
      boatName: ix.boat >= 0 ? r[ix.boat] || null : null,
      boatType: t.startsWith("sail") ? ("sail" as const) : t.startsWith("power") || t.startsWith("motor") ? ("power" as const) : null,
    };
    const [existing] = await tx.select().from(members)
      .where(and(eq(members.email, email), eq(members.firstName, firstName), eq(members.lastName, lastName)));
    if (existing) { await tx.update(members).set({ ...extra, active: true }).where(eq(members.id, existing.id)); updated++; }
    else { await tx.insert(members).values({ firstName, lastName, email, ...extra, linkToken: newToken(), feedToken: newToken() }); added++; }
  }
  return { added, updated, skipped };
}
