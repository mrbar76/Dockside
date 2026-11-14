// Runs before each hosted build: brings the database up to date and, in demo
// mode only, fills an empty database with the made-up demo clubs.
// With no database connected yet it does nothing, so the first build still passes.
import { execSync } from "node:child_process";
import pg from "pg";

// Hosts that pool connections (Neon on Vercel) also give a direct address,
// which is the right one for changing tables.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.log("predeploy: no DATABASE_URL yet, skipping migrations");
  process.exit(0);
}
const env = { ...process.env, DATABASE_URL: url };
execSync("npx tsx lib/db/migrate.ts", { env, stdio: "inherit" });

const client = new pg.Client({ connectionString: url });
await client.connect();
const { rows } = await client.query("select count(*)::int as n from clubs");
await client.end();
if (rows[0].n === 0 && process.env.DEMO_MODE === "true") {
  console.log("predeploy: empty database in demo mode, loading demo clubs");
  execSync("npx tsx lib/db/seed.ts", { env, stdio: "inherit" });
} else {
  console.log(`predeploy: ${rows[0].n} club(s) present, leaving data alone`);
}
