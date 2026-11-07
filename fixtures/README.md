# fixtures

Files unit tests run on, so every normalizer and every page can be built and tested without the game files or the network. One subfolder per purpose:

- `schema/` — one **synthetic** object per entity, used only to round-trip the Zod types and their JSON Schema. Not game data: class names start with `TEST_`, stats are placeholders, nothing here is displayed or seeded. See `schema/README.md`.
- `bootstrap/` — a data pack (manifest plus one JSON array per entity) of five ships, their stock loadouts and the referenced components from the Star Citizen Wiki API, with its credit line (spec 00, criterion "Fixtures"); placeholders until real extraction. Written only by `scripts/bootstrap-fixtures`; `samples/` holds raw API responses trimmed by rule for the mapper's tests.
- `<game-version>/` — real extracted records captured per build by the pipeline (spec 01). Small, committed.
- `linking/` — the labeled 200-item sample for entity-link precision (spec 03).
- `fankit/` — git-ignored downloads for placeholder renders.
