# ADR-023: A daily refresh keeps the catalog, figures and funding current

- Status: accepted
- Date: 2026-11-09
- Deciders: owner ("make sure we are building in protocols to keep all info on the site always updated. CIG is always changing ship specs, releases, components, damage figures, funding etc. We need to perhaps daily scrape everything in our catalog and implement changes", 2026-11-09), Claude Code session 2026-11-09
- Amends: ADR-015 (the weekly loaner check becomes one source of the daily refresh)
- Amended by: ADR-056 (a Vercel cron job starts the refresh at 06:23 UTC through the dispatch API; the schedule is the backup and stands aside when the clock ran); ADR-059 (the News workflow starts the refresh when the wiki serves a new build; a new build's patch comparison lands first; parts read from the wiki's list, each ship once a run)

## Context

Until Phase 1 (spec 01) every figure on the site comes from fixtures that dev scripts copy from public sources: the ship catalog with its components and hardpoints from the Star Citizen Wiki API (ADR-004, ADR-022), announced ships from RSI's ship matrix (ADR-010), loaners from RSI's support article (ADR-015), pledge and shop prices from the wiki and RSI's pledge pages (ADR-013), ship descriptions from the wiki (ADR-008), the funding counters from the wiki's stats endpoint (ADR-018) and the titles from the wiki's article (ADR-017). Each script runs when someone runs it. The only automation is the weekly loaner check, which opens a pull request for review, and it has failed on every run because the repository variable it needs was never set.

CIG changes all of this without notice: a build changes every stat, the ship matrix gains ships and changes statuses, prices move, the counters move every day. The owner wants the site to follow on its own.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| What runs | `scripts/refresh/index.ts`, every day at 06:23 UTC and on demand, from `.github/workflows/refresh.yml`. It runs the existing fetchers in order, cheapest check first, and never a new one: the fetchers already halt on unknown shapes and write nothing on a halt | One job, one log, one summary; the rules the fetchers carry (CLAUDE.md section 5, "imports halt on unknown shapes") hold unchanged |
| Game data | One request reads the build the wiki API serves (`/api/game-versions/default`, the request the bootstrap itself opens with). Only when it differs from the pack's `GameVersion` does the job rebuild the whole pack (`scripts/bootstrap-fixtures`, `"all": true`) and the descriptions; a `workflow_dispatch` input forces a rebuild | A build is the unit of change for game data (CLAUDE.md section 5: a published version is immutable, a fix is a new version); a rebuild is some three thousand requests at the polite limit, about two hours, and is worth it only for a new build |
| Daily sources | Every run refreshes the ship matrix (one request), the loaner matrix (one), the titles (one), the funding counters (about twenty) and the pledge and shop prices (one per ship on the wiki, one per concept ship on RSI) | They change between builds; together about 350 requests, under half an hour at the polite limits |
| Nothing but real change | A fetcher that rewrites its file with a new `fetched_at` and the same content is reverted by the job: files are compared with their stamps removed, and only a change in the data stays | Otherwise every run commits a timestamp |
| Gate | Before anything lands, the job runs the unit suite (every fixture-based test) and a full `next build` on the refreshed fixtures, in the job itself | Pushes made with the workflow token do not start the CI workflow, so the job carries the same checks; a page that cannot render the new data fails the build and nothing lands |
| Landing | When the checks pass, the changes are committed to `main` as `data: refresh <date>: <what changed>` and pushed; the deployment follows from `main` as for any commit. These commits hold fixtures only, no code, and are the one kind of commit that lands without a pull request or an audit | The owner's ask is that the site follows CIG by itself; the review a data change needs is the schema validation and the suite, which the job runs; the trail is the commit and the job log |
| Failure | A fetcher that halts (an unknown shape, a source down) opens or updates an issue carrying its report; nothing is written for that source and the sources that did refresh still land. A gate that fails opens an issue too and parks every change of the day on a branch, nothing lands: `data/refresh-build-<build>` when the catalog was rebuilt, which the job then leaves alone (it does not fetch that build again until the branch is merged or deleted, or a run is forced), `data/refresh-<date>` otherwise. The run is marked failed in both cases | "Imports halt on unknown shapes" ends in a human (or a Claude Code session) adding a rule, not in the job guessing |
| RSI's address | The sources on robertsspaceindustries.com need `SC_HUB_CONTACT_EMAIL` (CLAUDE.md section 9). Without the variable the job skips them, says so in its summary and opens an issue once; it does not fail | The address is the owner's to choose (ADR-005); the wiki sources need not wait for it |
| Images and models | Not part of the job: RSI's ship pictures and holoviewer models stay local and git-ignored (ADR-009, ADR-019). The summary names the files that changed, `fixtures/ship-matrix/ConceptShip.json` among them, so the owner knows when to fetch pictures locally | A deployment has no CIG imagery either way |
| News and developer posts | Not part of the job: spec 03's pollers run continuously on Fly.io when built | A different cadence and runtime |
| The weekly loaner check | Replaced: `.github/workflows/loaner-matrix.yml` is removed; `loaners.ts` is one of the daily sources | One job instead of two |

## What the job does not hide

- A new build replaces the pack (append.ts keeps rows only within a build); slugs are pinned against the pack on disk whatever its build, so a vehicle that gains a namesake keeps its slug (CLAUDE.md section 5).
- The descriptions follow the pack: they run after a rebuild, and also whenever the file on disk is missing or for another build than the pack's. Coverage is not a reason to run: a vehicle the wiki has no text for never gets a row (one of the 253 today), and a gate on the count would fetch every description every day.
- After a stamp-only revert the page's "copied <date>" line keeps the earlier date: the data was checked that day, not copied; a "checked" date on the pages is a later change.
- A concept pledge offer carries `observed_at`, so once the RSI sources run the prices commit daily; the funding counters commit daily by design.
- A removed title halts the titles fetcher until `TITLES_ACCEPT_REMOVED` names it, which the workflow cannot pass: that one needs a local run and a pull request.

## Consequences

- `scripts/` gains `refresh/`; the CLAUDE.md section 4 line on `scripts/` reads that one orchestrator runs daily in CI (this ADR) rather than the weekly check.
- `docs/runbooks/refresh.md` says what runs, how to read the summary and an issue, and how to force a rebuild.
- The owner sets the repository variable `SC_HUB_CONTACT_EMAIL` once; until then the RSI sources (ship matrix, loaners, pledge prices) do not refresh and the job says so.
- Phase 1 replaces the game-data source, not the protocol: the patch-day pipeline publishes a new version from the game files and the import job flips the channel pointer; the other sources keep refreshing this way.
