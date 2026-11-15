// Run by the deploy step: gives an existing MRBYC demo the yearly calendar and
// dues if it was created before they existed. Never touches a non-demo club.
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import * as s from "./schema";
import { addMrbycYear, hasMrbycYear } from "./demo-year";

async function main() {
  if (process.env.DEMO_MODE !== "true") return;
  const [club] = await db.select().from(s.clubs).where(eq(s.clubs.slug, "mrbyc"));
  if (!club?.settings.demo || (await hasMrbycYear(club.id))) return;
  await db.update(s.clubs).set({ settings: { ...club.settings, duesRule: { dueMonthDay: "03-01", lateFeePct: 20, lapseMonthDay: "04-01" }, fees: { ...club.settings.fees!, treasurer: "the Treasurer" } } }).where(eq(s.clubs.id, club.id));
  const r = await addMrbycYear(club.id, club.timezone);
  console.log(`demo-upgrade: MRBYC calendar (${r.events} events) and ${r.bills} dues bills added`);
}
main().then(() => pool.end(), (e) => { console.error(e); pool.end(); process.exit(1); });
