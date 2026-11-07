import { defineConfig } from "vitest/config";

// Unit tests run on files in fixtures/, never on the live network (CLAUDE.md section 6).
// vitest.setup.ts replaces global fetch with a function that throws, so a test that
// reaches for the network fails loudly instead of passing by accident.
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "packages/*/__tests__/**/*.test.ts",
      "apps/*/__tests__/**/*.test.ts",
      "workers/*/__tests__/**/*.test.ts",
      "pipeline/__tests__/**/*.test.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
  },
});
