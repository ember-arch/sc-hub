# fixtures/holo

RSI's holoviewer models (ADR-015): the OpenCTM file each ship's RSI pledge page loads into its holoviewer, and the human figure RSI stands beside every ship for scale. The models are git-ignored and never committed; only this README and `sources.json` are.

`sources.json` records, for each file: the ship's slug, the exact URL, the RSI pledge page that shows it, the size, SHA-256, vertex and triangle counts and when it was fetched. The URLs live in `scripts/media/holo.ts`; RSI's ship matrix does not list them, so they were read from each pledge page's holoviewer.

Copy, then build the web copies the site reads:

```
pnpm exec tsx scripts/media/fetch-holo.ts
pnpm --filter schema build && pnpm exec tsx scripts/media/prepare.ts
```

The fetch makes one request per file, at least 5 seconds apart, with no cookies or signed-in session, and decodes each file once so a model the decoder cannot read halts the run. `prepare.ts` packs each into a meshopt-compressed glTF in metres under `apps/web/public/media/holo/`. Showing these models on the public site is not yet decided (`docs/legal/cig-approval.md`).
