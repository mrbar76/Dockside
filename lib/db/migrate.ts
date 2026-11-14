import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./index";

migrate(db, { migrationsFolder: "./db/migrations" })
  .then(() => console.log("migrations applied"))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
