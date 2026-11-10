# fixtures/rsi-media

RSI's official image of each ship in `fixtures/bootstrap`, copied from the public ship matrix for local development (ADR-009). The images are git-ignored and never committed; only this README and `sources.json` are.

`sources.json` records, for each image: the ship's `class_name`, its RSI page, the exact image URL, the content type, size, SHA-256 and when it was fetched. A ship gets an image only on an exact name and manufacturer-code match with exactly one ship-matrix row.

Regenerate, then build the web copies the site reads:

```
pnpm exec tsx scripts/media/fetch-rsi.ts
pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
```

The fetch makes one request for the ship matrix and one per ship, at least 5 seconds apart, with no cookies or signed-in session. It fetches one image per pack ship and per concept ship, nothing else (ADR-022): RSI's terms forbid scraping and harvesting, and one picture per entry at the polite rate is the whole of it. Showing these images on the public site is not yet decided (ADR-009, "Not decided").
