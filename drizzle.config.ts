import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./lib/db/schema.ts", "./lib/db/auth-schema.ts"],
  out: "./db/migrations",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://pg@127.0.0.1:5433/dockside" },
  entities: { roles: { include: ["dockside_app"] } },
});
