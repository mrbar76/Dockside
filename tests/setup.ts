import { execSync } from "node:child_process";

// Tests run against their own database, migrated and seeded fresh each time.
export default function setup() {
  const env = { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://pg@127.0.0.1:5433/dockside_test" };
  execSync("npx tsx lib/db/migrate.ts && npx tsx lib/db/seed.ts", { env, stdio: "pipe" });
}
