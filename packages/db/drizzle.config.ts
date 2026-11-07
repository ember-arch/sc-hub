import { defineConfig } from "drizzle-kit";

// Used only by `pnpm --filter db generate` and `check`. Migrations are applied at runtime by
// src/migrate.ts, never by `drizzle-kit push` or `migrate`, so no database credentials live here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
});
