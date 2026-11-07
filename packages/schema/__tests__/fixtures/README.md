# Schema test fixtures

One valid object per entity, used only to round-trip each Zod type and its JSON Schema in unit tests. These are **synthetic schema examples**, not game data: every class name starts with `TEST_`, every stat is a placeholder, nothing here is displayed anywhere or seeded into a database. Real fixtures from extracted records live in the repo-root `fixtures/` folder (spec 00 criterion "Fixtures", then spec 01).
