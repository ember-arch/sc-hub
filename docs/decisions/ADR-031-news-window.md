# ADR-031: The news window opens with DefenseCon 2956

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("keep collecting the Spectrum posts and building the gallery for dispatches, but we should only do posts and news articles going as far back as the beginning of Invictus Launch Week 2026, no need to do so beyond that", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-027 (the pack's reach), spec 03's Backfill criterion

## Context

The pack held every Comm-Link the wiki's list gave back to June 2025 (405) and a year of staff posts from Spectrum (1,182, ADR-027). The owner wants the site to carry only what was published from the beginning of Invictus Launch Week 2026 on.

In 2026 Invictus Launch Week 2956 was folded into Drake's DefenseCon 2956: Invictus moved to Sol, out of reach in the game, and Drake's event ran from 14 to 27 May 2026 and took the whole of Invictus Launch Week in (the wiki's DefenseCon 2956 article; the free fly opened on 14 May). The beginning of that week is the event's first day, 14 May 2026.

Two things the cut showed in the pack: 203 Comm-Link records, ids 20602 to 21049, carried the wiki's import time, 2026-05-25T10:00Z, as their publication time rather than RSI's (the wiki recorded them in one batch that morning; RSI's own pages state no time); all 203 are older than the event week by their ids, below the week's first id, 21084. And one record, 20755, carries a wiki time of 26 May 2026 for a Comm-Link about Alpha 4.3.1, from September 2025.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| The window | `NEWS_WINDOW_START`, 2026-05-14T00:00:00Z, in `packages/schema/news-window.ts`, with `inNewsWindow(publishedAt)`; one constant the pollers and the site share | The event's first day, UTC; the owner's words name the week, not a time of day |
| The pollers | The news store records nothing published before the window and answers "older" for it (`put`); every poller counts those answers in its summary and the roadmap poller logs each, so a stale board stamp or a wiki record dated before the window is seen, not lost in silence. The Spectrum worker skips an older post before it makes an author row, and its first `since` is the window rather than 2025. The Comm-Link archive backfill (`--backfill` on `workers:poll-news`) is refused: the hub lists everything newer than the window, and the wiki's older records carry its import time as their date, so a backfill would bring the 203 batch-dated records back under a date inside the window | Nothing older is collected, as asked, and the one path that could re-admit the batch-dated records is closed |
| The site | `visibleNews` hides a row published before the window whatever the pack holds | The same rule on read, so a row that slips in shows nothing |
| The pack | Trimmed once to the window: 938 rows left (272 Comm-Links, 666 Spectrum posts), 649 stay (133 Comm-Links, 516 posts by 34 authors). The 203 batch-dated records left with them, by their ids; 20755, dated inside the window by the wiki, stays as the one known wrong date. `Author.json` is recounted and keeps the 34 authors with a post in the window; `comm-link-state.json` and `fixtures/rsi-media/cover-sources.json` keep only the Comm-Links that stay | The owner's cut; keeping 5 MB of rows the site may never show would be collecting beyond the window in all but name. Append-only (CLAUDE.md section 5) governs what a source's change does to an item, not the owner's choice of what the site carries; the trim is recorded here and in the data commit |
| Spec 03's Backfill | Read as "back to the window": the twelve months of the criterion reach further than the owner wants | The owner's decision supersedes the figure |

## Alternatives considered

| Option | Why not |
| --- | --- |
| Hide older rows and keep them in the pack | The pack would go on carrying, and the workflow go on committing, what the owner said not to bother with |
| A floor on RSI's Comm-Link ids instead of the date | Ids are given when a draft is made, not when it is published: the June 2026 subscriber promotion is 21052, below the event week's 21084 |
| Re-date the 203 batch records from their titles | A title names a date for a roadmap roundup and nothing else; a guessed date is hand-entered data |

## Consequences

- `packages/schema` gains `news-window.ts`; `workers/poll-news/src/store.ts` answers "older"; `workers/poll-spectrum/src/index.ts` starts at the window; `apps/web/lib/data.ts` hides older rows; tests on each.
- A roadmap change is dated by the board's own stamp of its last update rather than the card's (ADR-027 chose the card's): a card moved between releases keeps the older stamp of its last edit, which the window read as old news, while the board's stamp is RSI's own time of the change.
- The Comm-Link archive backfill (`--backfill` on `workers:poll-news`) is refused by the worker; `backfillCommLinks` stays for a later window.
- Known and left: record 20755 shows as a May 2026 dispatch (the wiki's date; RSI's pages state none); 26 of the 34 authors have a `first_seen` before the window, from posts no longer on the pack, kept since it is what the worker saw; a roadmap change's `external_id` carries the board's stamp, so two changes of one kind to one card across runs in which the board's stamp did not move would fall into one item; a new Comm-Link whose wiki record is dated before the window keeps the hub's blurb and time for good, counted as older in the run's summary.
- `fixtures/news/README.md` and spec 03 say so; ADR-027's reach is amended by this record.
