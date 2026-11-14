import { defineConfig } from "vitest/config";

const url = process.env.TEST_DATABASE_URL ?? "postgres://pg@127.0.0.1:5433/dockside_test";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup.ts"],
    env: { DATABASE_URL: url, DEMO_MODE: "true" },
    fileParallelism: false,
  },
});
