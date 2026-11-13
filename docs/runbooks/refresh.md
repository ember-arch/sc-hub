# Runbook — the daily refresh

What keeps the site's figures current until Phase 1, and what to do when it needs a hand (ADR-023). Nothing here is run by hand on a normal day: `.github/workflows/refresh.yml` runs `scripts/refresh/index.ts` every day at 06:23 UTC. A Vercel cron job starts it then through the dispatch API (ADR-056); the workflow's own schedule is the backup, and its run stands aside when any dispatched run, the clock's or one started by hand, was created on the same UTC date.

A new build does not wait for the next morning (ADR-059): while CIG's release notes name a LIVE version newer than the pack's figures, the News workflow asks the wiki for its build every half hour (one request) and starts the refresh as soon as the wiki serves it. A build is asked for once (`fixtures/refresh/early.json`); not while a refresh is running or waiting, nor while the build waits on a fix.

## What a run does

0. **A new build's patch comparison first** (ADR-059). The patch snapshot step runs alone (below), goes through `pnpm test` and `pnpm build`, and lands on `main` straight away, so `/patches` compares the new build some twenty minutes after the start. Failing its checks, it stays in the tree and lands or waits with the rest.
1. **Catalog.** One request reads the build the Star Citizen Wiki API serves. If it differs from the pack's `fixtures/bootstrap/GameVersion.json`, the whole pack is rebuilt (`scripts/bootstrap-fixtures`, every vehicle in the build) and the ships' descriptions follow. Ships are read one at a time with their hardpoints (about 330); their stock parts come from the wiki's item list, some twenty pages, with a part the list lacks read alone (ADR-059). Within a run the steps share their wiki reads (`WIKI_RUN_CACHE_DIR`), so the patch snapshot, the catalog, the descriptions and the prices read each ship once between them. A new build takes some half an hour in all. Otherwise nothing is fetched for the catalog.
   **Patch snapshots** (ADR-049), run first as above and again in the full pass, which finds a build already on file: one request lists the builds the Wiki API keeps, and the oldest build without a file in `fixtures/patches/` is fetched (one a run, about 300 requests, some 13 minutes). A build already on file is never fetched again; a new build that lists under nine tenths of the newest file's vehicles or parts halts the step (the wiki is still importing it) and is tried again the next day.
2. **Ship matrix, loaners, prices.** RSI's sources, one request each for the matrix and the loaner article, one per ship for the prices. They need the repository variable `SC_HUB_CONTACT_EMAIL`; without it they are skipped and the run says so.
3. **Titles, funding.** The wiki's Titles article and its funding counters.
4. Only real changes stay: a file rewritten with a new `fetched_at` and the same data is put back.
5. The refreshed fixtures go through `pnpm test` and `pnpm build` in the job. When they pass, the changes land on `main` as `data: refresh <date>: <what changed>`, and the deployment follows as for any commit. When they fail, nothing lands: the changes wait on a branch (`data/refresh-build-<build>` after a rebuild, which the job then leaves alone; `data/refresh-<date>` otherwise) and the run is marked failed.

The run's summary (one line per source) is on the workflow run's Summary page.

## When it opens an issue

- **"Refresh needs attention: <source>"** — a fetcher halted. The issue quotes its report, usually a shape the fetcher does not know (a new hardpoint type, a renamed field, a table the parser does not recognise). Nothing was written for that source; the others landed. Open a Claude Code session, paste the report, and let it add the rule in the fetcher (the type tables in `scripts/bootstrap-fixtures/map.ts`, the parsers under `scripts/titles/`, and so on) with a test, as ADR-022 records for the first full catalog. Never edit the fixtures by hand. Then rerun the workflow from the Actions tab. On a new build the catalog issue comes first: the prices and descriptions halt too while the pack is for the old build, and clear once the catalog does. A removed title is the one halt a rerun cannot clear: the titles fetcher wants `TITLES_ACCEPT_REMOVED` to name it, so run it locally with that set and open a pull request.
- **"Refresh needs attention: the checks failed on the refreshed fixtures"** — the data fetched cleanly but a test or the build failed on it. The fixtures are on `data/refresh-build-<build>` (after a rebuild) or `data/refresh-<date>`; open the branch in a session, find what the pages or tests assumed, fix the code, and merge the branch through a pull request as usual. While a build's branch exists the job does not fetch that build again; delete the branch instead if the fix should refetch.
- **"Refresh: set SC_HUB_CONTACT_EMAIL so RSI's sources refresh"** — the owner's one-time task: under the repository's Settings, Secrets and variables, Actions, Variables, add `SC_HUB_CONTACT_EMAIL` with the project's contact address (ADR-005). Close the issue; the next run refreshes the RSI sources.

## Forcing a rebuild

Actions, Refresh, Run workflow, tick "Rebuild the catalog even if the build is unchanged". Use it when the wiki corrected data for the current build, or after a fetcher gained a rule.

## Running it on a machine

```
pnpm --filter schema build && pnpm exec tsx scripts/refresh/index.ts [--force-rebuild] [--only <step,…>] [--out <folder>]
```

Set `SC_HUB_CONTACT_EMAIL` for the RSI sources, and `BOOTSTRAP_CACHE_DIR` (a folder outside the repository) to replay wiki responses while developing. `WIKI_RUN_CACHE_DIR` (a folder outside the repository, emptied before each run) makes the steps share their reads as the job does; `--only patches` runs one step, as the job's first pass does. The summary, commit message and issue text are written to the `--out` folder (the system temp folder by default). Images and holoviewer models are not part of the refresh: RSI's pictures stay local (ADR-009); fetch them with `scripts/media/fetch-rsi.ts` after a concept ship gains an entry.
