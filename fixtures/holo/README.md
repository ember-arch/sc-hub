# fixtures/holo

RSI's holoviewer models (ADR-015, ADR-025): the OpenCTM file each ship's RSI pledge page loads into its holoviewer, one for every ship the store lists with a model, and the human figure RSI stands beside every ship for scale. The models are git-ignored and never committed; only this README, `sources.json` and `samples/` (one real page of the store's listing, which the parser's unit test reads) are.

The addresses come from the store's own listing (`scripts/media/store.ts`): the ship list page asks the store's data endpoint for every ship, thirty a page, and each ship's answer carries its model's address, the same request the page sends and nothing more. A catalog ship takes the model of the store ship on the pledge page `fetch-rsi.ts` recorded for it; a name match would be a guess. Files are named by RSI's media id, so a model two editions share is kept once.

`sources.json` records, for each ship page with a model: the slug, the file, the exact URL, the pledge page, the store's title, the size, SHA-256, vertex and triangle counts and when it was fetched.

Copy, then build the web copies the site reads:

```
pnpm exec tsx scripts/media/fetch-holo.ts
pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
```

The fetch makes a few requests for the listing and one per model file, every one at least 5 seconds apart, with the project User-Agent and no cookies or signed-in session; a file already on disk from the same address is kept, so a run that stops carries on. Each new file is decoded once so a model the decoder cannot read halts the run. `prepare.ts` packs each file once into a meshopt-compressed glTF in metres under `apps/web/public/media/holo/`; the pages that share a model share the copy. Showing these models on the public site is not yet decided (`docs/legal/cig-approval.md`).
