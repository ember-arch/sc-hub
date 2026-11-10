# Spec 07 — The full catalog

- Phase: between spec 02's pages and Phase 1's data spine
- Machine: owner's PC or laptop for the fetch (the Wiki API and RSI's public pages, at the polite limits); any machine for the site
- Gate: every ship in the current build and every announced ship has an entry on a preview of `main`; Lighthouse performance and accessibility ≥ 90 on the register and the front page

## Goal

The owner's direction (2026-11-09): "build out the full ship catalog and all of the ship pages (both live and in concept)". The pages exist and were built for the whole catalog; the data was six ships. This spec widens the data to every ship, from the same sources the bootstrap used, until Phase 1 replaces the pack's origin with the game files (ADR-022).

## Out of scope

- Holoviewer models for every ship: each model's address is on its RSI pledge page, a further decision (ADR-022). The showcase ships keep theirs.
- Any change to the pages' design (spec 06).
- Phase 1 itself (spec 01).

## Acceptance criteria

- [x] **Every flyable ship.** `scripts/bootstrap-fixtures` with `"all": true` fetches every vehicle the Wiki API lists for the current build with a production status (vehicles the ship matrix does not list are counted and left out, ADR-022), maps and validates it as before, and writes the pack under the 40 MB cap; the pack is committed; every vehicle has an entry page, and the register, compare, the palette and the sitemap carry every entry (an edition that shares another's name is listed under it, ADR-022); unit and e2e tests pass on the full pack.
- [x] **Every announced ship.** `scripts/media/snapshot-matrix.ts` writes every ship-matrix row that is not flight ready and not in the pack to `fixtures/ship-matrix/ConceptShip.json` with RSI's figures, each with a slug the pack does not use; every one has an entry page labelled in concept, with RSI's figures and their source.
- [x] **Images for all of them.** `scripts/media/fetch-rsi.ts` copies RSI's ship-matrix image for every pack ship and every concept ship (local only, ADR-009), reusing files already on disk; `prepare.ts` writes the concepts' renditions into the manifest; the front page, the register and the entries show them where a showcase has none.
- [x] **Performance holds.** Lighthouse performance and accessibility stay at 90 or more on the front page, the register (cards and table) and a ship page with the full pack, in CI.
- [x] **Kept current.** `scripts/refresh/index.ts` runs daily from `.github/workflows/refresh.yml` (ADR-023): it rebuilds the pack only when the Wiki API serves a new build, refreshes the ship matrix, loaners, prices, titles and funding every day, keeps only real changes, checks them with the unit suite and a full build, lands them on `main` as one data commit, and opens an issue with the fetcher's report when a source halts. The weekly loaner workflow is removed; `docs/runbooks/refresh.md` says how to read a run and an issue.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`, then `pnpm test:e2e` against the full pack.
- Screenshots at 390 px and 1280 px, light and dark, of the front page, the register and one new concept entry, with media aside.
- A fresh-context audit (`KICKOFF.md`, Audit prompt); findings fixed or deferred in the PR description.
