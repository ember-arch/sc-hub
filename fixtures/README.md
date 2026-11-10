# fixtures

Files unit tests run on, so every normalizer and every page can be built and tested without the game files or the network. One subfolder per purpose:

- `schema/` — one **synthetic** object per entity, used only to round-trip the Zod types and their JSON Schema. Not game data: class names start with `TEST_`, stats are placeholders, nothing here is displayed or seeded. See `schema/README.md`.
- `bootstrap/` — a data pack (manifest plus one JSON array per entity) of five ships, their stock loadouts, the referenced components and the loadout editor's catalogue of swappable parts (ADR-016) from the Star Citizen Wiki API, with its credit line (spec 00, criterion "Fixtures"); placeholders until real extraction. Written only by `scripts/bootstrap-fixtures`; `samples/` holds raw API responses trimmed by rule for the mapper's tests.
- `<game-version>/` — real extracted records captured per build by the pipeline (spec 01). Small, committed.
- `linking/` — the labeled 200-item sample for entity-link precision (spec 03).
- `fankit/` — git-ignored: the CIG fankit, unpacked (its logos, holoviewer models and agreement). Maker logos come from here (ADR-009).
- `acquisition/` — pledge-store offers, UEX Corp's community-reported in-game shop prices and loaners for each ship, copied by `scripts/bootstrap-fixtures/acquisition.ts` (ADR-013). Not game data.
- `galleries/` — git-ignored: the Star Citizen Wiki's gallery of RSI's art per ship, copied by `scripts/media/fetch-galleries.ts` (ADR-024); only `sources.json`, the parser's sample and the README are committed
- `rsi-media/` — git-ignored: RSI's official image of each pack ship, copied from its public ship matrix by `scripts/media/fetch-rsi.ts`; only `sources.json` (where each came from) and the README are committed (ADR-009).
