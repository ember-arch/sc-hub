# Spec 01 — Data spine

- Phase: 1 (weeks 3 to 6)
- Machine: Windows PC for extraction and model checks; laptop or cloud for normalizers, import, search
- Gate: every flyable ship and its stock loadout imports for LIVE and PTU with zero unknown-shape errors, and the patch-day runbook is one command

## Goal

Real game data flowing end to end: detect a build, extract DataCore records with StarBreaker, normalize onto `packages/schema`, diff against the previous version, publish a versioned data pack to R2, import it into Postgres, index it in Meilisearch, flip the channel pointer. Capture fixtures from real records so every later phase and every future patch has regression coverage.

## Out of scope

3D model export beyond a single smoke test (Phase 4). Any UI beyond what Phase 0 already renders. Loadout math.

## Prerequisites

- Windows PC with LIVE and PTU installed, StarBreaker installed, `SC_INSTALL_ROOT` and `STARBREAKER_BIN` set.
- R2 write credentials on the Windows PC only.
- About 150 GB free on the PC for extraction output.

## Acceptance criteria

- [ ] **Version detection.** `pnpm pipeline:detect` reads each installed channel's build string and reports it; a run is tagged with channel and version; a version already published is refused unless `--force`.
- [ ] **Raw extraction.** `pnpm pipeline:extract --channel LIVE` runs StarBreaker to dump DataCore records for vehicles, items, loadouts, ports, manufacturers, and English localization into `pipeline/out/<channel>/<version>/raw/`. Record counts and elapsed time are logged. The command is idempotent.
- [ ] **Fixtures per version.** `pnpm pipeline:fixtures` copies raw records for a fixed list of 12 ships spanning sizes and manufacturers, plus every item their stock loadouts reference, into `fixtures/<version>/`, under 5 MB, binary blobs stripped. Fixtures are committed.
- [ ] **Vehicle normalizer.** Maps raw vehicle records to `Vehicle` and `VehicleStats`; passes schema validation on every fixture; unit tests cover a small fighter, a multi-crew ship, a capital, and a ground vehicle.
- [ ] **Port and loadout normalizer.** Produces `Port` rows with nesting and `default_item_class`; a test asserts the stock loadout of each fixture ship matches the in-game default (owner verifies three by hand in the PR).
- [ ] **Item normalizer.** Maps raw items to `Item` and `ItemStats` for every `ItemType`; type-specific fields populated where the record has them; everything else lands in `raw`.
- [ ] **Manufacturer and localization.** Manufacturers derived from records; English display names applied; a missing localization key is logged, not invented.
- [ ] **Unknown-shape handling.** A record that fails validation halts the run, writes `pipeline/reports/<run_id>.md` listing the record, the failing field, and a sample, and exits non-zero. Tested with a deliberately mutated fixture.
- [ ] **Diff.** `diff.json` per run lists added, removed, and changed entities and fields versus the previous published version of the same channel, with old and new values.
- [ ] **Publish.** `pnpm pipeline:publish` validates the pack against JSON Schema, writes `manifest.json` (version, channel, files, checksums, counts), uploads to `data/<channel>/<version>/` in R2, and refuses to overwrite an existing version.
- [ ] **Import job.** `pnpm workers:import --channel LIVE --version <v>` downloads the manifest, verifies checksums, validates again, upserts all entities in a transaction, computes slugs (respecting `slug_history`), and flips `is_current`. Re-running the same version is a no-op.
- [ ] **Search index.** The import job rebuilds the Meilisearch index for vehicles, items, and manufacturers with the fields the palette needs (name, slug, manufacturer, type, role) and swaps it atomically. `/ships/[slug]` and the palette now read from Postgres and Meilisearch, not fixtures.
- [ ] **Cross-check.** A script compares numeric fields for all vehicles against the Star Citizen Wiki API for the same version and reports agreement. Target ≥ 95% within tolerance; every disagreement is listed, none is auto-corrected.
- [ ] **Both channels.** LIVE and PTU both published and imported; the ship page shows the PTU diff toggle with real differences.
- [ ] **Runbook.** `docs/runbooks/patch-day.md` is complete and `pnpm pipeline:all --channel <c>` runs detect → extract → normalize → fixtures → diff → publish, then triggers the import job, and prints the summary line.

## Suggested order

1. Detection and raw extraction on the PC (Prompt W1). Capture fixtures.
2. Normalizers on the laptop against fixtures: vehicles, then ports and loadouts, then items.
3. Unknown-shape halting and the report.
4. Diff, manifest, publish.
5. Import job, slug logic, search index swap.
6. Wire the site to Postgres and Meilisearch; remove bootstrap fixtures from the app path.
7. Cross-check script. PTU run. Runbook.

## Verification

All unit tests on fixtures green; a full LIVE run from a clean `pipeline/out/` completes; import is idempotent (second run changes nothing); the owner spot-checks three ships' loadouts in game; the cross-check report is attached to the PR.

## Notes

- StarBreaker's output format is the one thing this phase cannot control. Pin its version in `pipeline/package.json` and record the pinned commit in an ADR.
- Do not reach for the wiki API to fill gaps in extracted data. If a field is missing from the game files, it stays empty and the gap is noted.
