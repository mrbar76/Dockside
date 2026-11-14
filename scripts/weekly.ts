// Weekly message job. On Railway, run as a scheduled job: `npm run weekly`.
import { db, pool, withClub } from "../lib/db";
import { clubs } from "../lib/db/schema";
import { sendWeekly } from "../lib/core/deliver";

const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
(async () => {
  for (const club of await db.select().from(clubs)) {
    const n = await withClub(club.id, (tx) => sendWeekly(tx, club, origin));
    console.log(`${club.slug}: weekly message prepared for ${n} members`);
  }
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
