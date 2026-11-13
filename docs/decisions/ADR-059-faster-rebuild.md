# ADR-059: A new build lands in minutes: the early start, the comparison first, and fewer reads

- Status: accepted
- Date: 2026-11-13
- Deciders: owner ("there must be a way to do this faster / smarter", 2026-11-13, then "Build all three"), Claude Code session 2026-11-13
- Amends: ADR-023 (the daily refresh), ADR-049 (the patch pages), ADR-056 (the refresh clock), ADR-027 (the News workflow's steps)

## Context

4.10.3 went LIVE at 15:17 UTC on 12 November. The Star Citizen Wiki API, the site's only source of figures, published it on 13 November, sometime after the 06:23 UTC refresh had run. So nothing would have read it until 06:23 the next day; the owner asked why, and the refresh was started by hand at 15:09. That run then took over two hours. The owner asked for a faster, smarter way.

Where the time went, measured on the code and the API that day:

- **Waiting to start.** The refresh checks the wiki's build once a day (ADR-023, ADR-056). The owner had earlier turned down an hourly check ("hours is probably too frequent").
- **Reading every part alone.** The rebuild read each ship (about 330, with hardpoints) and then each of some 2,500 stock parts on its own, 2.5 seconds apart (CLAUDE.md section 9 caps the wiki at 30 a minute). The parts were most of the two hours.
- **Reading every ship up to four times.** The patch snapshot, the catalog, the descriptions and the prices each read every ship in the same run.
- **The comparison waited for everything.** The patch snapshot (`/patches`, about 300 requests) ran after the catalog rebuild and landed with it.

What the API offers, tested the same day (a few dozen spaced requests):

- `/api/items` lists hold the same record a single read does (every field the rebuild keeps; only `entity_tags` and `entity_tag_map`, which the rebuild drops, differ), 200 a page. `filter[type]` takes several types at once. Most ship-specific thrusters, fuel intakes and armour are named "<= PLACEHOLDER =>" and left out of the list unless `filter[include_irrelevant]=true` (found in the API's own description, `/api/openapi`). With it, every stock type the pack holds came to 3,786 records in 19 pages.
- The ship list is no shortcut: with `include=hardpoints` it carries a trimmed port tree (59 of the Javelin's 202 ports, without the fitted parts), so ships are still read one at a time.
- A ship's plain read and its `include=hardpoints` read are the same record.

Raising the request limit was not considered: the wiki is a volunteer-run free service and the limit is the project's own rule.

## Decision

| Concern | Decision | Why |
| --- | --- | --- |
| Start | The News workflow, every half hour, runs `scripts/refresh/early.ts`. While CIG's release notes in the news pack name a LIVE version newer than the pack's figures (`releasedAhead`, the rule the footer and the patch pages use, now in `apps/web/lib/patch-notes.ts` so a script can use it), it asks the wiki for its default build: one request. A build newer than the pack's, not asked for before, starts `refresh.yml`, unless a refresh is running or waiting or the build waits on a fix (`data/refresh-build-<build>`). The build is recorded in `fixtures/refresh/early.json`, so a build is asked for once; the daily refresh stays the backstop | Starts within half an hour of the wiki publishing; the rest of the time it asks nothing, which keeps to the owner's "not hourly" |
| The comparison first | `refresh.yml` runs the patch snapshot alone first (`scripts/refresh/index.ts --only patches`), runs `pnpm test` and `pnpm build` on it, and lands it on `main`. Then the full pass runs as before and finds the build on file. Failing its checks, the snapshot stays in the tree and lands or waits with the full pass | `/patches` shows the new build's comparison some twenty minutes after the start, not after the whole rebuild |
| The patch pages | `/patches` and its masthead measure a release ahead against the newest LIVE patch snapshot (`patchRelease`), so a comparison that landed first shows as the latest; the footer on every page keeps measuring against the pack (`currentRelease`) and still says the site's other figures are from the build before, until the rebuild lands | Each page says what its own figures are from |
| Parts | The rebuild collects the types of the stock parts the ports name and reads them from the item list, every type at once, placeholders included (`scripts/bootstrap-fixtures/stock.ts`). A part the list lacks, or lists for another build, is read on its own as before | Some twenty requests where there were about 2,500 |
| Each read once a run | The wiki client keeps ship, part and blueprint reads in `WIKI_RUN_CACHE_DIR` (the job sets it under `RUNNER_TEMP`; unset elsewhere, nothing is kept), keyed so that a ship's read with or without `include=hardpoints`, and with or without `version=` naming the build the run read, is one read. Checks of the builds are never kept | The patch snapshot, the catalog, the descriptions and the prices read each ship once between them |

## Consequences

- A new build should reach `/patches` about twenty minutes after the wiki serves it, and the rest of the site in well under an hour, against a wait of up to a day and then two hours.
- The rebuild's request count falls from about 3,000 to about 500 (the ships, the part pages, the patch snapshot's lists and blueprints), so the wiki sees far fewer requests for the same data.
- The News workflow gains one wiki request a run while a release is pending, usually a day or less per patch.
- A run started by the early check also refreshes RSI's sources a second time that day; once per patch.
- If the patch comparison's checks fail, its own commit message is lost: it lands with the full pass's message, or waits with it on the branch.
- Verified before merging: the new reads were run against 4.10.3 and the pack, descriptions and patch snapshot compared with what the two-hour run of 13 November produced.
