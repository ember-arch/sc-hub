# ADR-003: Toolchain pins and repository conventions

- Status: accepted
- Date: 2026-11-06
- Deciders: owner, Claude Code session 2026-11-06 (spec 00, criteria 1 and 2, plus the CI skeleton for criterion 3)

## Context

ADR-001 fixes the stack (pnpm workspaces, TypeScript strict, Next.js, Zod, Vitest, Playwright, Lighthouse CI) but not the versions, the lint and format setup, or the small layout choices that every later package inherits. Phase 0 criterion 1 is the moment those get decided. Two facts forced explicit choices: on npm, `typescript@latest` is now 7.0 (the native compiler), and pnpm 12 refuses to install when a dependency has an unreviewed build script.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Package manager | pnpm 12.18.0, declared in `packageManager`; CI reads it from there | Current major; `pnpm/action-setup` needs no version input |
| Dependency build scripts | `allowBuilds` map in `pnpm-workspace.yaml`; `esbuild: false` is the first entry | pnpm 12 errors on unreviewed scripts. esbuild ships platform binaries as optional packages and does not need its post-install. A package is added to the map only after its script has been read. |
| Workspace dependencies | Always `workspace:*`, never a version range | Package names are unscoped (below) and collide with real npm packages; pnpm 10+ does not link workspace packages by default, so `"schema": "^0.0.0"` would fetch npm's `schema` |
| Node | 24 (`.node-version`, `engines.node >= 24`) | Installed on the owner's machines; current LTS line |
| TypeScript | 5.9.3, pinned exactly | typescript-eslint 8.72 supports TypeScript below 6.1 only. Revisit 7.x when it does. |
| Compiler options | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `module: NodeNext` | Strictest practical set; NodeNext means relative imports carry `.js` extensions. `apps/web` will override module resolution for Next.js (`bundler`) in its own tsconfig. |
| Lint | ESLint 10 flat config, `@eslint/js` recommended + typescript-eslint recommended, `eslint-config-prettier` last; `no-explicit-any` is an error | CLAUDE.md section 6: no `any` without a comment; a justified `any` carries a disable-next-line comment with the reason |
| Format | Prettier 3.9 defaults (80 columns) with `endOfLine: lf`; `.gitattributes` forces LF in the repo; `*.md` and `fixtures/` are not format-checked | Windows checkouts otherwise churn every file to CRLF; markdown and committed data are not code |
| Unit tests | Vitest 5, one root config; `vitest.setup.ts` replaces global `fetch` with a function that throws | Pollers and fetchers use `fetch`, so the guard catches the realistic mistake. It does not block `node:http`; that stays a review item. |
| Synthetic schema fixtures | `fixtures/schema/<Entity>.json`, one valid object per entity, `TEST_` names, documented as not game data | Section 6 says unit tests run on files in `fixtures/`; a subfolder per purpose (`schema/`, `bootstrap/`, `<version>/`, `linking/`) keeps real and synthetic apart |
| Contract library | Zod 4.6.7, pinned exactly in `packages/schema` | The pipeline and the web must agree byte for byte on what validates; a caret here is a silent contract change |
| JSON Schema | Zod 4 built-in `z.toJSONSchema`, draft 2020-12, emitted to `packages/schema/dist/json/` at build; Ajv validates the emitted schemas against the same fixtures in tests | No second schema library; the pipeline's validator and the web's parser come from one source |
| URLs in the contract | `z.url({ protocol: /^https?$/ })` for displayed links (`ContentItem.url`) and for every URL environment variable | A displayed link must never be `javascript:`; `z.url()` alone also accepts `localhost:7700` as a scheme |
| `ContentItem.revision` | Starts at 1; positive integer | The first fetch is revision 1; the data model only says integer, so this pins the convention before the first poller |
| Workspace package names | Unscoped: `schema`, later `ui`, `db`, `web` | `pnpm --filter schema build` is the spec's literal command, and the undecided project name (CLAUDE.md section 12) is not baked into import paths |
| Schema package layout | Source files at the package root, no `src/` | `packages/schema/env.ts` is the literal path CLAUDE.md names three times |
| Timestamps in the contract | ISO 8601 strings with offset | The contract is JSON; Drizzle maps them to timestamp columns in `packages/db` |
| Environment validation | One `envSchema` with every variable optional, plus `loadEnv(role)` for `web`, `worker`, `pipeline` that enforces the required subset from the section 9 table; `SPECTRUM_MODE` defaults to `off` | Vercel never sees R2 secrets; the Windows PC never needs Postgres; a missing variable still fails startup by name |
| Task runner | None (plain `pnpm -r`) | Not in ADR-001; nothing to cache yet |
| Kit fix | `docs/legal/evidence/.gitkeep` is tracked (`.gitignore` ignores the folder's contents, not the folder) | The kit ignored the whole folder, so it vanished on a fresh clone; no new folder is added |

## Alternatives considered

| Option | Why not |
| --- | --- |
| TypeScript 7.0 | typescript-eslint rejects it (peer range `< 6.1`); Next.js and Vitest support unverified. Pin now, revisit with one line in this ADR. |
| `allowBuilds: { esbuild: true }` | Runs a post-install script that only re-checks an already-present binary; `false` is the smaller surface |
| Scoped package names (`@sc-hub/schema`) | Bakes the working title into every import; renaming later touches every file |
| `src/` layout in `packages/schema` | Breaks the literal `packages/schema/env.ts` path in CLAUDE.md for no gain |
| Synthetic fixtures inside `packages/schema/__tests__/` | Contradicts section 6's "unit tests run on files in `fixtures/`" |
| Turborepo | Adds a dependency and a config before there is anything to cache; add with an ADR if CI time hurts |
| `zod-to-json-schema` | Zod 4 emits JSON Schema natively |
| Date objects in the contract | Not JSON; every boundary would need a transform |
| Cross-field refinements in Zod (`char_end >= char_start`, `crew_min <= crew_max`, `size_min <= size_max`) | JSON Schema cannot express them, so the pipeline's validator and the web's parser would disagree; they belong in normalizer tests (spec 01) |

## Consequences

- Every new package extends `tsconfig.base.json` and gets `typecheck` and `build` scripts so `pnpm -r --if-present` picks them up.
- A dependency with a build script fails `pnpm install` until it is listed in `allowBuilds`; that is the intended review moment.
- Relative imports in TypeScript end in `.js`.
- Prettier's 80-column default decides line wrapping; nobody argues about it in review.
- `packages/schema` exports point at `dist/`, and CI runs typecheck before build. Decided in ADR-004: the root `typecheck` script builds `schema` first, and Vitest aliases `schema` to its source so `pnpm test` needs no build.
- The CI `e2e` and `lighthouse` jobs start the moment `apps/web/package.json` exists. The Site shell PR must add `@playwright/test` and `@lhci/cli`, replace `FIXTURE_SLUG` in `lighthouserc.json`, and make `pnpm test:e2e` real, or those jobs fail.
- Format rules for `game_version`, `class_name` and `manufacturer_code` are `min(1)` until Phase 1 shows real strings; tightening them then is a schema change and a new data version, by design.
- When typescript-eslint supports TypeScript 7, the pin in the root `package.json` and this ADR change together.
