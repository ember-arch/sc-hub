import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/.lighthouseci/**",
      "pipeline/out/**",
      "**/next-env.d.ts",
      "**/*.tsbuildinfo",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  {
    // React components in packages/ui and apps/web run in the browser as well as on the server.
    files: ["**/*.tsx", "apps/web/**/*.ts"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // CLAUDE.md section 6: no `any` without a comment explaining why. A justified `any`
      // carries a disable-next-line comment stating the reason; a silent one fails lint.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
    },
  },
  prettier,
);
