# ADR-025: The holoviewer model for every ship, from the store's listing

- Status: accepted
- Date: 2026-11-10
- Deciders: owner ("we need the holoviewer models, that's part of what makes the Perseus and Odin pages so great, the one at the top and the comparisons; we need to source all the holoviewer files", 2026-11-10), Claude Code session 2026-11-10
- Amends: ADR-009 (whose models row ruled out the store's data calls), ADR-015 (the holoviewer models), ADR-022 (which deferred them), ADR-024 (which left them as the next step)

## Context

The Odin and the Perseus open on RSI's holoviewer model of the ship and stand it in the Scale lineup beside the others (ADR-015, ADR-020). Seven ships had models, each address read by hand off its pledge page; the other 270 entries drew an envelope in the lineup and opened on a picture. The owner wants every page at the templates' standard, the model included.

The pledge store is an app. A ship page's HTML holds no model address; the page asks the store's data endpoint (`robertsspaceindustries.com/graphql`, the same origin, no sign-in) for the ship, and the answer's `media.ctm` field is the model's address, which the page's viewer then loads from the store's media path. The ship list page asks the same endpoint for every ship, thirty a page. Both answers are readable with the same request the page sends and nothing more: no session, no token, no page rendering.

## Decision

| Concern | Choice | Reason |
| --- | --- | --- |
| Source | `scripts/media/fetch-holo.ts` asks the store's listing for every ship (`store.ts`: one query, the fields the page itself reads, thirty ships a page, nine pages in November 2026), then copies each model once. Every request is at least 5 seconds apart with the project User-Agent and contact address (CLAUDE.md section 9: the endpoint is a robertsspaceindustries.com page for the rate's purposes); nothing else on the store is read | Nine listing requests replace three hundred page reads; the models are the ones RSI publishes to every visitor's browser, which the fan sites the owner pointed to already show |
| Match | A catalog ship takes the model of the store ship whose page is the pledge page `fetch-rsi.ts` recorded for it from the ship matrix (`matchModels`): the same path, exactly one store ship on it, a model present. Two store ships on one page, none, or no model: no model, and the reason is in the run's log | The page address is RSI's own key for the ship on both lists; a name match would be a guess (CLAUDE.md section 2) |
| Files | One file per model, named by RSI's media id (`fixtures/holo/<id>.ctm`), so a model two editions share is copied once; `sources.json` records, per ship page, the file, the address, the page, the store's title, size, checksum, vertex and triangle counts and the time. `prepare.ts` packs each file once into `/media/holo/<id>.glb` (meshopt, metres) and every ship page that shares it points at the same copy. The human figure is unchanged. All of it is local and git-ignored (ADR-009, ADR-019); the README, `sources.json` and the listing sample (`fixtures/holo/samples/`) are committed | Some 230 models at a few MB each; the lineup and the viewer already load by need (ADR-015), so the count does not change the pages |
| Shape | An answer that is not a listing (`StoreShapeError`), a model address of an unknown form, or a file the OpenCTM decoder cannot read halts the run; a run that stops carries on from the files already on disk | CLAUDE.md section 5: unknown shapes halt |
| Refresh | Not part of the daily refresh (ADR-023): the models are local only. A new ship's model waits for a local run, which reuses every file already copied | Same footing as the pictures |
| What the site does | Nothing new: `media().holo(slug)` answers for every matched ship, so the ship file opens on the model, the compare pages and the Scale lineup stand the ship up as its model instead of an envelope, and the "Model: RSI holoviewer" credit links the pledge page | The pages were built for it (ADR-015, ADR-020) |

## Consequences

- `scripts/media/holo.ts` keeps only the human figure's address; the hand-kept list of seven is gone.
- `fixtures/holo/sources.json` grows from eight rows to one per ship page with a model; the seven earlier files are copied again under their media ids and the old copies can be deleted.
- A store ship no catalog page claims (a ship the matrix does not list under that page) is logged as unused; a catalog ship the store lists without a model (the 85X, the Merchantman, the PTV, the Pulse, the Ursa Fortuna, the P-72 Emerald in November 2026) keeps its envelope.
- ADR-022's deferral and ADR-024's "next step" are closed; spec 07 gains the criterion.
- Showing the models on the public site is still the standing question of `docs/legal/cig-approval.md` ("RSI holoviewer models"); the owner's instruction to proceed as if approved (ADR-019) stands.
- A listing read short would shrink the record, since it is rebuilt each run: the fetcher halts when fewer than half the ship pages on record match, and writes nothing.
