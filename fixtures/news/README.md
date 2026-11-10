# fixtures/news

The news pack (ADR-027): what the news pollers (`workers/poll-news`) have seen, committed like the ship pack because it is the site's data until Fly and Postgres exist.

- `ContentItem.json`: every content item, every revision, append-only (CLAUDE.md section 5). A source that changes an item makes a new row with the next revision; the site shows the latest revision of each and hides rows with the takedown flag. Ids are derived from the source, the source's own id and the revision, so a row is the same row everywhere.
- `roadmap-state.json`: RSI's Release View board as the poller last saw it; the next run's changes against it become roadmap items.
- `Author.json`: every CIG staff member seen on Spectrum, with handle, display name, role, first seen and post count, nothing else. The site reads it only with `SPECTRUM_MODE` on.
- `samples/`: one real response per source from 2026-11-10 (RSI's Comm-Link hub page, the wiki's record of one Comm-Link, a cut of the roadmap board), which the parsers' unit tests read. No test reaches the network.

Comm-Link text comes from the Star Citizen Wiki API's record of each Comm-Link (the hub page carries titles and links, the transmission pages no text), and the feed credits it (`WIKI_CREDIT`). Every item links its original on the source site.

Run the pollers by hand with `pnpm workers:poll-news` (`--source comm_link` or `roadmap` for one). `.github/workflows/news.yml` runs them every thirty minutes and commits what changed; a run with an error writes nothing. `pnpm workers:poll-spectrum` writes Spectrum items and authors when `SPECTRUM_MODE` is `poll` (the newest page of the last week's staff posts; `--backfill <pages>` reads that many pages of the last year, five minutes apart) or `feed`; the real responses its tests read are in `fixtures/spectrum/samples/`. Spectrum items in the pack reach a page only when the site's own `SPECTRUM_MODE` is on.
