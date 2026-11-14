import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

const g = globalThis as unknown as { __docksidePool?: Pool };
export const pool =
  g.__docksidePool ?? (g.__docksidePool = new Pool({ connectionString: process.env.DATABASE_URL, max: process.env.VERCEL ? 3 : 10 }));

// Unscoped connection. Use only for the club list, sign-in tables, migrations
// and the few cross-club jobs in lib/core/system.ts.
export const db = drizzle(pool, { schema: { ...schema, ...authSchema } });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// The one door to club data. Inside fn, the database itself refuses to read or
// write another club's rows, whatever the query says.
export async function withClub<T>(clubId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role dockside_app`);
    await tx.execute(sql`select set_config('app.club_id', ${clubId}, true)`);
    return fn(tx);
  });
}

export { schema, authSchema };
