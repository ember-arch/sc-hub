import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const schemaSource = (file: string): string =>
  fileURLToPath(new URL(`./packages/schema/${file}`, import.meta.url));

// Unit tests run on files in fixtures/, never on the live network (CLAUDE.md section 6).
// vitest.setup.ts replaces global fetch with a function that throws, so a test that
// reaches for the network fails loudly instead of passing by accident.
export default defineConfig({
  resolve: {
    // Tests resolve the `schema` workspace package to its TypeScript source, so `pnpm test`
    // needs no build and sees schema edits live. Everything else consumes the built dist
    // (ADR-004). Regex finds keep `schema/env` from being rewritten as `index.ts/env`.
    alias: [
      { find: /^schema$/, replacement: schemaSource("index.ts") },
      { find: /^schema\/env$/, replacement: schemaSource("env.ts") },
      { find: /^schema\/pack$/, replacement: schemaSource("pack.ts") },
    ],
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "packages/*/__tests__/**/*.test.ts",
      "apps/*/__tests__/**/*.test.ts",
      "workers/*/__tests__/**/*.test.ts",
      "pipeline/__tests__/**/*.test.ts",
      "scripts/__tests__/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
});
