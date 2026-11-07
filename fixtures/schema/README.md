# fixtures/schema

One valid object per entity in `docs/data-model.md`, used only by `packages/schema` unit tests to round-trip each Zod type and its emitted JSON Schema. These are **synthetic schema examples**, not game data: every class name starts with `TEST_`, every stat is a placeholder, nothing here is displayed anywhere or seeded into a database. Real records captured from the game live in `fixtures/<game-version>/` (spec 01); wiki-sourced bootstrap data lives in `fixtures/bootstrap/` (spec 00). Adding a field to an entity means adding it here too, or the round-trip test fails.

`Manifest.json` is the one non-entity file here: a synthetic data-pack manifest for the `Manifest` type in `packages/schema/manifest.ts`.
