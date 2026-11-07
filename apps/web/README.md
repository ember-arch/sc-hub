# apps/web

The Next.js site (App Router, Tailwind 4 from `packages/ui` tokens, ADR-005). Phase 0 reads the bootstrap fixture pack through `lib/data.ts`; Postgres and Meilisearch replace that module with their specs.

- `pnpm --filter web dev` starts it on http://localhost:3000 (`pnpm dev` from the root does the same).
- `pnpm --filter web test:e2e` runs Playwright: disclaimer on five routes, the three key screens at 390 px and 1280 px light and dark into `e2e/__screenshots__/`, and every component story into `packages/ui/__screenshots__/`.
- `/gallery` lists the component stories; it is not linked from the site and is `noindex`.
- `scripts/licenses.ts` writes `generated/licenses.json` (git-ignored) before `dev` and `build`; `/licenses` renders it.
