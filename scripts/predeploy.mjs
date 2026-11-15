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
// Demo databases seeded before uploads existed have placeholder "#" links.
// Give each one a small sample file so every document opens.
if (process.env.DEMO_MODE === "true") {
  const { rows: stale } = await client.query(
    "select d.id, d.title, d.club_id, d.members_only, c.slug from documents d join clubs c on c.id = d.club_id where d.url = '#' and (c.settings->>'demo')::boolean",
  );
  for (const d of stale) {
    const text = `${d.title}\n\nThis is a sample for the demo. The club uploads the real ${d.title.toLowerCase()} here, and members open it from the Documents page.\n`;
    const { rows: [f] } = await client.query(
      "insert into files (club_id, name, type, size, data, members_only) values ($1, $2, 'text/plain', $3, $4, $5) returning id",
      [d.club_id, `${d.title}.txt`, Buffer.byteLength(text), Buffer.from(text), d.members_only],
    );
    await client.query("update documents set url = $1 where id = $2", [`/${d.slug}/files/${f.id}`, d.id]);
  }
  if (stale.length) console.log(`predeploy: gave ${stale.length} demo document(s) a sample file`);
  // The MRBYC demo follows the club's real application form (revised Jan 2026).
  const membership = {
    fees: { initiation: 300, dues: 165, payTo: "MRBYC", mailTo: "MRBYC, Attn: Membership, 98 Strickland Road, Cos Cob, CT 06807" },
    committees: ["House Committee", "Membership", "Ways & Means", "Pump Out & Marine Facilities", "Social & Entertainment", "Children's Events", "Annual Bluefish Tournament", "Tidewatcher e-newsletter"],
    residency: "the Town of Greenwich", sponsorRequired: true, proofsRequired: 2,
    slipNote: "Dock slips have a waiting list kept by the Town, not the club. To get on it, apply in person at the Greenwich Town Hall Recreation Department.",
    address: "98 Strickland Road, Cos Cob, CT 06807",
  };
  const { rowCount } = await client.query(
    "update clubs set settings = settings || $1::jsonb where slug = 'mrbyc' and (settings->>'demo')::boolean and settings->'fees' is null",
    [JSON.stringify(membership)],
  );
  if (rowCount) {
    await client.query("update members set title = 'Membership Governor' where title = 'Social Governor' and club_id = (select id from clubs where slug = 'mrbyc')");
    await client.query("delete from documents where title = 'Membership application' and club_id = (select id from clubs where slug = 'mrbyc')");
    console.log("predeploy: MRBYC demo now uses the club's real membership rules");
  }
}
await client.end();
if (rows[0].n === 0 && process.env.DEMO_MODE === "true") {
  console.log("predeploy: empty database in demo mode, loading demo clubs");
  execSync("npx tsx lib/db/seed.ts", { env, stdio: "inherit" });
} else {
  console.log(`predeploy: ${rows[0].n} club(s) present, leaving data alone`);
}
