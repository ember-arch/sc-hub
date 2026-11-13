# Spec 00 — Foundation

- Phase: 0 (weeks 1 to 2)
- Machine: laptop or cloud session
- Gate: the owner signs off three key screens built on fixture data, light and dark, phone and desktop

## Goal

A repo where every later phase has a place to land: the monorepo and its scripts, the schema contract, the design system with its first components, a site shell that renders fixture data on real routes, CI that enforces the rules, and the legal pages. Nothing here touches the game files.

## Out of scope

Real extracted data (Phase 1), any poller (Phase 3), any 3D (Phase 4). The viewer slot on the ship page shows a fankit render placeholder.

## Prerequisites from the owner

- GitHub repo created; this kit committed.
- Accounts and tokens in a local `.env`: Vercel, Neon, Cloudflare (R2 bucket, domain), Fly.io, Sentry.
- `docs/legal/cig-approval.md` filled in as far as it can be.
- Fankit downloaded to `fixtures/fankit/` (git-ignored) for placeholder renders.

## Acceptance criteria

- [x] **Monorepo scaffold.** pnpm workspaces with the exact layout from `CLAUDE.md` section 4. Every script in `CLAUDE.md` section 6 exists; stubs print "not implemented in Phase 0" and exit 1.
- [x] **Schema package.** `packages/schema` exports Zod types for every entity in `docs/data-model.md`, the enumerations, and `env.ts`. `pnpm --filter schema build` emits JSON Schema to `packages/schema/dist/json/`. Unit tests round-trip each type through a fixture object.
- [ ] **CI.** GitHub Actions on every PR: typecheck, lint, unit tests, Playwright e2e, Lighthouse CI on `/`, `/ships/<fixture-slug>`, `/news`. Vercel preview deploy linked in the PR. A failing budget (performance or accessibility under 90) fails the PR.
- [x] **Database package.** `packages/db` with Drizzle schema derived from `packages/schema`, migration `0001_init`, and `pnpm db:seed` loading `fixtures/` into a local or Neon database.
- [x] **Fixtures.** `fixtures/bootstrap/` holds five ships of different sizes and manufacturers, their stock loadouts, and the referenced components, sourced from the Star Citizen Wiki API with the credit line recorded, under 2 MB total. These are placeholders until Phase 1 replaces them with extracted records.
- [x] **Design tokens.** `packages/ui/tokens.ts` holds every value in `docs/design/system.md` section 2; Tailwind config is generated from it; an ADR records the chosen font pair.
- [x] **Core components.** `packages/ui` ships the Phase 0 set in `docs/design/system.md` section 3, each with a light and dark Playwright screenshot in `packages/ui/__screenshots__/`.
- [x] **Site shell.** `apps/web` routes exist and render fixture data: `/`, `/ships`, `/ships/[slug]`, `/components`, `/components/[slug]`, `/manufacturers/[slug]`, `/news`, `/news/dev` (empty state), `/about`, `/privacy`, `/licenses`. Every page uses `PageShell` and `EntityPage` where applicable.
- [x] **Command palette.** Opens with ⌘K and from the persistent button; searches fixture entities client-side for now; keyboard navigable; closes on escape. Meilisearch wiring is Phase 2.
- [x] **Legal footer.** The verbatim disclaimer and attribution lines render on every page; an e2e test asserts it on five routes; `packages/ui/legal.ts` records the source URL and copy date.
- [x] **Patch strip.** Shows LIVE and PTU version strings from `GameVersion` rows (fixture values for now) on home and in the footer. (Since ADR-049's amendment of 2026-11-12, a LIVE version CIG has released ahead of the figures shows first, "figures from" the build on record.) (Since ADR-007, one strip per page, in the footer; home's footer carries it. Since ADR-046, PTU only when a PTU build is recorded.)
- [ ] **Infrastructure provisioned.** Neon database, R2 bucket with CDN domain, Fly app for Meilisearch (deployed, empty), Vercel project linked to the repo. Connection details validated by `env.ts` at startup. No secrets in the repo.
- [ ] **Three key screens signed off.** Home, one ship page, the news feed, each captured at 390 px and 1280 px in both modes, reviewed with the design-review prompt, and approved by the owner in the PR.

## Suggested order

1. Scaffold, scripts, CI skeleton (typecheck and lint only).
2. Schema package and fixtures.
3. DB package, migration, seed.
4. Tokens, font ADR, core components with screenshots.
5. Site shell routes on fixture data.
6. Legal footer, about, privacy, licenses.
7. Command palette.
8. Infrastructure, env validation, Vercel preview.
9. Full CI (e2e, Lighthouse), then the design review and sign-off.

## Verification

`pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` green; Lighthouse CI report attached; screenshots attached; preview URL in the PR; audit prompt run and findings addressed.

## Notes

- Do not over-build components. The Phase 0 set is the minimum that lets the three screens exist; anything more waits for a spec that needs it.
- Fixture data from the wiki API is bootstrap only. The credit line must appear on the pages that show it until Phase 1 replaces it.
