# ADR-003: Toolchain pins and repository conventions

- Status: accepted
- Date: 2026-11-06
- Deciders: owner, Claude Code session 2026-11-06 (spec 00, criteria 1 to 3)

## Context

ADR-001 fixes the stack (pnpm workspaces, TypeScript strict, Next.js, Zod, Vitest, Playwright, Lighthouse CI) but not the versions, the lint and format setup, or the small layout choices that every later package inherits. Phase 0 criterion 1 is the moment those get decided. Two facts forced explicit choices: on npm, `typescript@latest` is now 7.0 (the native compiler), and pnpm 12 refuses to install when a dependency has an unreviewed build script.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Package manager | pnpm 12.18.0, declared in `packageManager`; CI reads it from there | Current major; `pnpm/action-setup` needs no version input |
| Dependency build scripts | `allowBuilds` map in `pnpm-workspace.yaml`; `esbuild: false` is the first entry | pnpm 12 errors on unreviewed scripts. esbuild ships platform binaries as optional packages and does not need its post-install. A package is added to the map only after its script has been read. |
| Node | 24 (`.node-version`, `engines.node >= 24`) | Installed on the owner's machines; current LTS line |
| TypeScript | 5.9.3, pinned exactly | typescript-eslint 8.72 supports TypeScript below 6.1 only. Revisit 7.x when it does. |
| Compiler options | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `module: NodeNext` | Strictest practical set; NodeNext means relative imports carry `.js` extensions |
| Lint | ESLint 10 flat config, `@eslint/js` recommended + typescript-eslint recommended, `eslint-config-prettier` last; `no-explicit-any` is an error | CLAUDE.md section 6: no `any` without a comment; a justified `any` carries a disable-next-line comment with the reason |
| Format | Prettier 3.9 defaults (80 columns) with `endOfLine: lf`; `.gitattributes` forces LF in the repo | Windows checkouts otherwise churn every file to CRLF |
| Unit tests | Vitest 5, one root config; `vitest.setup.ts` replaces global `fetch` with a function that throws | Makes the "no network in unit tests" rule a failure, not a convention |
| JSON Schema | Zod 4 built-in `z.toJSONSchema`, draft 2020-12, emitted to `packages/schema/dist/json/` at build; Ajv validates the emitted schemas against the same fixtures in tests | No second schema library; the pipeline's validator and the web's parser come from one source |
| Workspace package names | Unscoped: `schema`, later `ui`, `db`, `web` | `pnpm --filter schema build` is the spec's literal command, and the undecided project name (CLAUDE.md section 12) is not baked into import paths |
| Schema package layout | Source files at the package root, no `src/` | `packages/schema/env.ts` is the literal path CLAUDE.md names three times |
| Timestamps in the contract | ISO 8601 strings with offset | The contract is JSON; Drizzle maps them to timestamp columns in `packages/db` |
| Environment validation | One `envSchema` with every variable optional, plus `loadEnv(role)` for `web`, `worker`, `pipeline` that enforces the required subset from the section 9 table; `SPECTRUM_MODE` defaults to `off` | Vercel never sees R2 secrets; the Windows PC never needs Postgres; a missing variable still fails startup by name |
| Task runner | None (plain `pnpm -r`) | Not in ADR-001; nothing to cache yet |

## Alternatives considered

| Option | Why not |
| --- | --- |
| TypeScript 7.0 | typescript-eslint rejects it (peer range `< 6.1`); Next.js and Vitest support unverified. Pin now, revisit with one line in this ADR. |
| `allowBuilds: { esbuild: true }` | Runs a post-install script that only re-checks an already-present binary; `false` is the smaller surface |
| Scoped package names (`@sc-hub/schema`) | Bakes the working title into every import; renaming later touches every file |
| `src/` layout in `packages/schema` | Breaks the literal `packages/schema/env.ts` path in CLAUDE.md for no gain |
| Turborepo | Adds a dependency and a config before there is anything to cache; add with an ADR if CI time hurts |
| `zod-to-json-schema` | Zod 4 emits JSON Schema natively |
| Date objects in the contract | Not JSON; every boundary would need a transform |

## Consequences

- Every new package extends `tsconfig.base.json` and gets `typecheck` and `build` scripts so `pnpm -r --if-present` picks them up.
- A dependency with a build script fails `pnpm install` until it is listed in `allowBuilds`; that is the intended review moment.
- Relative imports in TypeScript end in `.js`.
- Prettier's 80-column default decides line wrapping; nobody argues about it in review.
- When typescript-eslint supports TypeScript 7, the pin in the root `package.json` and this ADR change together.
