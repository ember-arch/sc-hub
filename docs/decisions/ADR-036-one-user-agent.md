# ADR-036: One User-Agent for every fetcher, built where every runtime can reach it

- Status: accepted (the owner's standing direction to build, audit and merge, ADR-019)
- Date: 2026-11-10
- Deciders: Claude Code session 2026-11-10
- Amends: ADR-004 (the deferred about-page URL and contact address), ADR-033 (a consequence of going live)

## Context

`docs/legal/obligations.md` has always asked every fetcher to identify itself as `<site name>/<version> (+<about-page URL>; <contact email>)`. ADR-004 deferred the about page and the address "because neither exists yet". Since 2026-11-10 both exist: the site is live at https://coppercork.com (ADR-033), the about page at https://coppercork.com/about, and ventures@coppercork.com is the published contact address (PR 46, `CONTACT_EMAIL` in `packages/ui/legal.ts`).

The fresh audit of PR 46 found that every outgoing header still read `sc-hub-<tool>/0.0 (non-commercial fan reference in development; github.com/ember-arch/sc-hub; <email>)`, built three times over: `scripts/user-agent.ts` for the dev scripts and the daily refresh, `workers/poll-news/src/client.ts` and `workers/poll-spectrum/src/index.ts` for the news workers. Three copies of one template had already drifted from the document they were meant to follow, and "in development" was no longer true.

The site name is the working title "SC Hub" (CLAUDE.md section 12), held in `packages/ui/brand.ts`. The workers must not import from `apps/web`, and `packages/ui` carries React peer dependencies that a worker has no business pulling in; `packages/schema` is the one package the scripts, the workers, `packages/ui` and the web app all depend on already.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Where the header is built | `userAgent(tool, contact)` in `packages/schema/site.ts`, exported as `schema/site` only (a subpath like `schema/env` and `schema/pack`, so `packages/ui` can take the name without the whole contract and its Zod schemas, and the package root stays the data contract); the three builders call it | One template, three callers; the package is already on every runtime's dependency list |
| The form | `SC-Hub/1.0 (+https://coppercork.com/about; ventures@coppercork.com) poll-news`: the obligations' form, then the job's name as a second product token | The form is the document's; the trailing token lets a source tell the pollers, the refresh and a dev script apart in its logs, which the old `sc-hub-<tool>` prefix did and the form alone would lose |
| The site name | `SITE_NAME` is written once, in `packages/schema/site.ts`; `packages/ui/brand.ts` re-exports it, so every page import stays as it was. The product token is the name with its spaces replaced by hyphens, `SC-Hub`, since an HTTP product token admits no space | The header and the pages cannot disagree about the name; CLAUDE.md section 12's placeholder moves one package down and is still one constant |
| The about page | `ABOUT_PAGE_URL`, `https://coppercork.com/about`, from the constant `SITE_ORIGIN`; not derived from `SITE_URL` | The fetchers run in CI and on the owner's machine, where `SITE_URL` is unset; the one place it is set is Vercel production, where no fetcher runs. Reading it would add a way to send a localhost or preview address to RSI and would change nothing when it is right |
| The version | `SITE_VERSION`, `1.0`, the first public release | The site is live; `0.0` said otherwise. Bumped by hand when a source operator would want to tell two eras of the site apart |
| The contact address | Still from `SC_HUB_CONTACT_EMAIL`, read by the caller and passed in; `null` leaves it out and the RSI callers still refuse to run without it (CLAUDE.md section 9) | Unchanged behaviour, and what the brief asked for; the module itself reads no environment, so the web app's bundles can import the name from it. The published address in `packages/ui/legal.ts` is the same string today; a fallback to it here would send the address from a machine the owner never configured, so the two stay apart and `obligations.md` says what the unset case sends |
| "in development" and the repository address | Dropped | The site is live, and the about page says where the code is |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Import `SITE_NAME` from `packages/ui` in the workers | `ui` lists React, React DOM and Next as peer dependencies; a worker taking the name from there takes the design system's dependency graph with it |
| Derive the about page from `SITE_URL` with the production origin as fallback | See the table: no fetcher runs where the variable is set, and the derivation only adds a wrong address to send |
| Three builders kept, each corrected by hand | That is how they drifted the first time |
| The exact form with no job token | A source operator could not tell which job of the project's five or six made a request; the repository's own logs name the run but not the request RSI saw |

## Consequences

- `packages/schema/site.ts` with `SITE_NAME`, `SITE_ORIGIN`, `ABOUT_PAGE_URL`, `SITE_VERSION`, `SITE_PRODUCT` and `userAgent`; the package exports `./site`; `vitest.config.ts` aliases it to source like the other subpaths. `packages/ui/brand.ts` re-exports `SITE_NAME`.
- `scripts/user-agent.ts` keeps `userAgent(tool)` and `rsiUserAgent(tool)` for its twenty call sites and reads `SC_HUB_CONTACT_EMAIL` as before; the two workers lose their own `userAgent` functions and call the shared one with `poll-news` and `poll-spectrum`.
- Tests pin the exact string in `packages/schema/__tests__/site.test.ts`, `scripts/__tests__/user-agent.test.ts` and `workers/poll-news/__tests__/client.test.ts`; the spectrum worker's tests inject their own header and were already indifferent to its text.
- `docs/legal/obligations.md` names the trailing job token and the module; ADR-004's deferral is closed with a note; CLAUDE.md section 9 says the address rides in every User-Agent, and section 12 names the constant's new home.
- When the owner settles the name (CLAUDE.md section 12), `SITE_NAME` changes in one file and the header follows at the next run. If the canonical origin ever changes, `SITE_ORIGIN` here and `SITE_URL` on Vercel both change; a test guards that the about page is on the production origin, not that the origin matches the deployment.
- The fresh audit of PR 48 found that the obligation's form and the code disagreed when `SC_HUB_CONTACT_EMAIL` is unset (the header then carries the about page alone, and only to the non-RSI sources); `obligations.md` now states that case rather than the code inventing an address. The Spectrum worker's two call sites are checked by inspection: its `main()` has no test, and its adapter tests inject their own header.
- `.env.example` still lacks `SC_HUB_CONTACT_EMAIL` and `SITE_URL` and still lists a `SPECTRUM_SESSION_COOKIE` that nothing reads since ADR-027; left for a housekeeping PR.
