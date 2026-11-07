# CLAUDE.md — SC Hub constitution

Read this file in full at the start of every session. It is the single source of rules for this repository. When a spec, a comment, or a chat instruction conflicts with this file, say so and ask before proceeding.

## 1. What this project is

SC Hub (working title) is a non-commercial fan reference site for Star Citizen. It merges four things into one cross-linked entity model: a news feed (RSI Comm-Links, patch notes, roadmap, video), a developer-post tracker (CIG staff posts on Spectrum), a ship and component database with specs per patch channel, and an in-browser 3D ship viewer built from game-extracted models.

The model to copy is Wowhead: every ship, component, manufacturer, news item, and developer post is an entity with a page, and entities link to each other. A dev post that mentions the Carrack appears on the Carrack page.

It is built solo by the owner (Tyler) with Claude Code. The owner makes product calls, owns the CIG relationship, signs off design, and runs the extraction pipeline on patch days. Claude Code builds everything else.

The full scope and plan live in `docs/scope.md`. Phase specs live in `docs/specs/`.

## 2. Hard rules (never)

- Never copy code from FleetYards (GPLv3), Erkul, or any other fan tool. Feature ideas are fair game; code is not.
- Never add ads, paid tiers, affiliate links, merchandise, or any monetization. Donations only if `docs/legal/cig-approval.md` says CIG approved them in writing.
- Never ship a page without the fan-site disclaimer in the footer (see `docs/legal/obligations.md`).
- Never commit secrets. All credentials come from environment variables listed in section 9.
- Never call an external source above the rate limits in section 9. Default to the polite limit when unsure.
- Never route models, textures, thumbnails, or other large assets through the app server. They are served from object storage behind the CDN.
- Never mutate a published data version. A fix is a new version.
- Never hand-enter game data. Every stat comes from the pipeline; if the pipeline cannot produce it, the field stays empty.
- Never add a color, type size, spacing value, or radius outside `packages/ui` tokens without an ADR.
- Never use emoji, glow, scanlines, hex grids, bevels, neon-on-black, or sci-fi display fonts anywhere in the UI. This is a reference product, not a game HUD.
- Never infer a game stat, a dev post's meaning, or an entity link with less than the confidence thresholds in `docs/data-model.md`.
- Never claim to CIG, in code comments, UI copy, or docs, that the site is official or endorsed.

## 3. Architecture in one paragraph

Three runtimes. The **Windows PC** (owner's machine, Star Citizen installed) runs `pipeline/` on patch days: StarBreaker extracts DataCore records and ship models from `Data.p4k`, TypeScript normalizers map them onto the shared Zod schema, gltf-transform compresses models into two tiers, and a publish step uploads a versioned data pack and models to Cloudflare R2. **Fly.io** runs the long-lived pollers (news, Spectrum), the import job (reads the R2 manifest, upserts Postgres, rebuilds the search index, flips the channel pointer), and Meilisearch. **Vercel** serves the Next.js site, which reads Postgres (Neon) and Meilisearch, and sends the browser straight to the CDN for models. `packages/schema` is the contract between pipeline and web; nothing crosses that boundary without validating against it.

## 4. Repository layout

```
CLAUDE.md
KICKOFF.md
docs/
  scope.md
  data-model.md
  design/system.md
  legal/cig-approval.md, obligations.md, takedown.md, attribution.md
  decisions/ADR-NNN-*.md
  specs/0N-*.md
  runbooks/patch-day.md
packages/
  schema/        Zod types + JSON schema export; the pipeline↔web contract
  ui/            design tokens + components (no app logic)
  db/            Drizzle schema, migrations, seed from fixtures
pipeline/        Windows-only: detect, extract, normalize, optimize, publish
apps/web/        Next.js app
workers/         pollers (news, spectrum), import job, link-entities job
fixtures/        real extracted records per game version; small, committed
scripts/         one-off dev scripts; nothing here runs in production
```

Create exactly this layout in Phase 0. Add folders only with an ADR.

## 5. Data contracts

Full detail is in `docs/data-model.md` and ADR-002. The rules that matter every session:

- **Identity** is the game `class_name` (for example `AEGS_Gladius`). Display names, slugs, and manufacturer prefixes are attributes. Slugs are derived once and never change after first publish.
- **Every stat row** carries `channel` (`LIVE` | `PTU` | `EPTU`) and `game_version` (the full build string, for example `4.3.1-live.10234567`). There is no unversioned stat anywhere.
- **LIVE is canonical.** PTU values display as a diff against LIVE, never as the default.
- **Published versions are immutable.** The import job writes a new version and flips `channel_current` in one transaction.
- **Imports halt on unknown shapes.** A record that fails schema validation stops the run, writes a report to `pipeline/reports/`, and nothing from that run goes live.
- **Entity links carry confidence** (0 to 1). Links below 0.9 are stored but hidden. The exclusion list in `workers/link-entities/exclusions.json` is the only place ambiguity is handled.
- **Content items** (news, dev posts) are append-only. Edits by the source create a new revision; the latest revision displays.
- **Takedown flag** on every content item and model: when set, the item returns 410 and is purged from search and CDN within one job cycle.

## 6. Engineering conventions

- pnpm workspaces, TypeScript `strict: true`, ESLint with the repo config, Prettier defaults. No `any` without a comment explaining why.
- Zod at every boundary: pipeline output, API routes, worker inputs, environment variables (`packages/schema/env.ts`).
- Drizzle for schema and migrations. One migration per PR at most. Migrations are forward-only.
- Tests: Vitest. Unit tests run on files in `fixtures/`, never on live network. Playwright for end-to-end and for screenshots. A PR that changes a page attaches screenshots of that page at 390 px and 1280 px widths.
- No network in unit tests. Pollers and fetchers take an injected `fetch` so fixtures can stand in.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `pipeline:`, `ui:`). One commit per acceptance criterion where practical.
- Branch per spec item: `spec/01-data-spine/normalize-vehicles`. Small PRs; a PR that touches pipeline and web is two PRs.
- Scripts are named consistently and exist from Phase 0 even if some are stubs:
  - `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`
  - `pnpm db:migrate`, `pnpm db:seed`
  - `pnpm pipeline:detect`, `pnpm pipeline:extract`, `pnpm pipeline:normalize`, `pnpm pipeline:models`, `pnpm pipeline:publish`, `pnpm pipeline:all` (the patch-day command)
  - `pnpm workers:import`, `pnpm workers:poll-news`, `pnpm workers:poll-spectrum`, `pnpm workers:link`
- Logging is structured JSON with a `run_id`. Every pipeline and worker run writes a summary line: counts in, counts out, errors, duration.
- Performance budgets are tests: Lighthouse CI fails a PR that drops performance or accessibility below 90 on the ship page, home, and news feed.

## 7. Design rules

Full system in `docs/design/system.md`. Non-negotiables:

- Tokens live in `packages/ui/tokens.ts` and nowhere else. Tailwind config is generated from them.
- One accent color. Semantic colors (success, warning, danger) only for status.
- Two type weights (400, 500). Three sizes per page. Tabular figures for every number.
- Light and dark both first-class; both are screenshot-tested.
- Every entity page uses the `EntityPage` template: hero, key facts, body sections, related entities.
- Tables: fixed column sets, sticky header, unit in header, sort on tap, and on phone the row expands rather than the table scrolling sideways.
- Motion only for viewer transitions and loading states.
- Copy: sentence case everywhere, no exclamation marks, no "please", no "click here".

## 8. Definition of done

A spec item is done when all of these are true:

1. Its acceptance criterion in `docs/specs/` is ticked in the same PR.
2. Tests exist and pass, including fixture-based tests for any parser or normalizer.
3. The PR has Playwright screenshots for any page it touched, light and dark, phone and desktop.
4. A Vercel preview deployment exists and the owner has been given its URL.
5. Any decision that was not already in an ADR has a new ADR.
6. An audit session (fresh Claude Code session, `KICKOFF.md` → Audit prompt) has reviewed the PR and its findings are addressed or explicitly deferred in the PR description.
7. `CLAUDE.md` and the spec are still accurate. If the work changed a rule, the rule is updated in the same PR.

## 9. Environments

| Machine | Runs | Has |
| --- | --- | --- |
| Owner's laptop or a cloud Claude Code session | `apps/web`, `packages/*`, `workers/*` development, all tests | Fixtures only; no game files |
| Windows PC (Star Citizen LIVE and PTU installed) | `pipeline/*` on patch days; hero-ship model export | Game installs, StarBreaker, R2 write credentials |
| Fly.io | Workers, import job, Meilisearch | Postgres and R2 credentials, Spectrum credentials |
| Vercel | `apps/web` | Postgres read, Meilisearch read |

Environment variables (validated in `packages/schema/env.ts`; a missing required variable fails startup):

```
DATABASE_URL
MEILI_HOST, MEILI_MASTER_KEY, MEILI_SEARCH_KEY
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, CDN_BASE_URL
SPECTRUM_MODE (feed | poll | off), SPECTRUM_FEED_URL, SPECTRUM_SESSION_COOKIE
SENTRY_DSN
SC_INSTALL_ROOT (Windows only, for example C:\Program Files\Roberts Space Industries\StarCitizen)
STARBREAKER_BIN (Windows only)
```

When `DATABASE_URL` is unset, `pnpm db:migrate` and `pnpm db:seed` use an embedded PGlite database in `packages/db/.pglite/` (local development only; ADR-004). Every deployed runtime requires it.

Rate limits (polite defaults; never exceed):

| Source | Limit |
| --- | --- |
| robertsspaceindustries.com pages | 1 request every 5 seconds per worker; identify with a project User-Agent and contact email |
| Spectrum (poll mode) | 1 request every 5 minutes per endpoint; back off to 30 minutes on any non-200 |
| api.star-citizen.wiki | 30 requests per minute (their stated cap is 60); credit line required on pages using its data |
| YouTube RSS | 1 request per hour |

## 10. Session workflow

1. Read this file and the current phase spec.
2. Enter plan mode. Propose the plan for the next one to three acceptance criteria. Wait for approval.
3. Build on a branch. Commit per criterion.
4. Verify: `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e` for pages, then screenshots.
5. Open the PR using the template. Tick the spec criteria in the same PR.
6. Stop and report: what was done, what the preview URL is, what is next. Do not start the next criterion without a go-ahead unless told to continue.

If a step cannot be completed (missing credential, unknown record shape, a design question), stop and ask. Do not work around it.

## 11. Glossary

- **class_name** — the game's internal identifier for an entity; the primary key everywhere.
- **channel** — LIVE, PTU, or EPTU game environment.
- **game_version** — the full build string of a channel at a point in time.
- **data pack** — one versioned folder in R2 holding normalized JSON and a manifest.
- **manifest** — the index of a data pack: version, channel, file list, checksums, record counts.
- **hero ship** — one of the 20 ships that get full 3D treatment in v1.
- **tier** — a model's size class: `preview` (≤ 8 MB) or `full` (≤ 25 MB).
- **entity link** — a resolved mention of an entity inside a content item.
- **kill switch** — the takedown flag on a content item or model.

## 12. Open decisions

| Decision | Current state | Placeholder in code |
| --- | --- | --- |
| Project name | Undecided; "SC Hub" is a working title | `SITE_NAME` constant in `packages/ui/brand.ts` |
| License | Undecided; MIT for code with assets and data excluded is the recommendation | `LICENSE` file is absent until decided; do not add one |
| Hero ship list | Undecided until Phase 4 | `pipeline/hero-ships.json` |
| Spectrum access method | Ask CIG for a feed; build the poller behind the adapter either way | `SPECTRUM_MODE` |

Do not resolve these yourself. Flag them when they block work.
