# fixtures/rsi-media

RSI's official image of each ship in `fixtures/bootstrap`, copied from the public ship matrix for local development (ADR-009). The images are git-ignored and never committed; only this README and `sources.json` are.

`sources.json` records, for each image: the ship's `class_name`, its RSI page, the exact image URL, the content type, size, SHA-256 and when it was fetched. A ship gets an image only on an exact name and manufacturer-code match with exactly one ship-matrix row.

Regenerate, then build the web copies the site reads:

```
pnpm exec tsx scripts/media/fetch-rsi.ts
pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
```

The fetch makes one request for the ship matrix and one per ship, at least 5 seconds apart, with no cookies or signed-in session. It fetches one image per pack ship and per concept ship, nothing else (ADR-022): RSI's terms forbid scraping and harvesting, and one picture per entry at the polite rate is the whole of it. Showing these images on the public site is not yet decided (ADR-009, "Not decided").

## Comm-Link covers (ADR-029)

`covers/` holds the picture RSI's Comm-Link hub shows for each Comm-Link in the news pack, one file per Comm-Link named by RSI's id; `cover-sources.json` records each file's address, the Comm-Link's page, type, size, SHA-256 and time. Git-ignored like the ship images; the dispatch cards show the covers only where they have been built.

```
pnpm exec tsx scripts/media/fetch-covers.ts
pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
```

The fetch reads the hub's pages (`?page=N`, ten transmissions a page) and then each cover not yet on disk, one request every 5 seconds, with the project User-Agent and the contact address and no session. It stops when every Comm-Link on record has its cover, when six pages in a row add nothing (the hub's pages are not in date order), or at `--pages <n>` (80 by default).
