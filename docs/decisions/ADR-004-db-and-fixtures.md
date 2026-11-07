# ADR-004: Database package and bootstrap fixtures

- Status: accepted
- Date: 2026-11-07
- Deciders: owner (Model channel, fixture ships, port path), Claude Code session for spec 00 criteria "Fixtures" and "Database package"

## Context

Phase 0 needs real-looking data before the game files are available, and a database that the site shell can read on a laptop with nothing installed. The spec asks for five ships from the Star Citizen Wiki API under 2 MB, and for `packages/db` with a Drizzle schema derived from `packages/schema`, a migration named `0001_init`, and `pnpm db:seed` loading `fixtures/` into a local or Neon database. ADR-003 left one question to the first in-repo consumer of `packages/schema`: how a package gets the schema's types without a hidden source/dist split.

Mapping real API data onto the model surfaced three gaps in `docs/data-model.md`, all decided by the owner during the work and fixed in the same PR.

## Decision

### Data packs and the contract

| Decision | Rationale |
| --- | --- |
| A **data pack** is `manifest.json` plus one JSON array per entity. `Manifest` (`packages/schema/manifest.ts`) records channel, game version, source, credit line and each file's sha256, bytes and row count. | The glossary already defines "manifest" as the index of a data pack. One shape for the bootstrap fixtures, the Phase 1 publish step and the import job. |
| `parsePack` (`packages/schema/pack.ts`) is the single validator: manifest shape, file bytes and sha256, row counts, every row against its entity type, duplicate primary keys, versioned rows matching the pack's channel and version, references resolving inside the pack, the model's uniqueness rules, and the port-path invariant. | ADR-002 rules 5 and 10: validate at every boundary with one definition of valid. The bootstrap script, the seed and later the import job all refuse what it rejects. A pack is self-contained. |
| `primaryKeys` (`packages/schema/keys.ts`) lists each entity's key fields. | The parser, the seed, the tables and the pack sort order read one source. |

### Three data-model changes the real data forced (owner decisions, 2026-11-06 and 2026-11-07)

| Change | Why |
| --- | --- |
| `Model` carries `channel`; its key is class_name + channel + game_version + tier. | CLAUDE.md section 5: every versioned row carries channel and game version. The model did not. |
| `Port` is keyed by `port_path` (parent paths joined by `/`), `port_name` stays the game's own name, and `parent_port_name` became `parent_port_path`. | The game reuses port names under different parents: each missile rack on the Gladius has a `missile_01_attach`. A name-only key cannot hold the real data. The path is derived from the parent's path and the port name, and `parsePack` enforces that. |
| Fixture ships: Mirai Fury (snub), Aegis Gladius (small), Drake Cutlass Black (medium), Anvil Carrack (large), RSI Polaris (capital). | Five sizes, five manufacturers, one ship with turrets so nested ports are covered. The owner first picked the Kruger P-52 Merlin for the snub slot; the wiki labels it small (the Fury family is the only snub it knows), so the Fury took the slot. Not the hero-ship list, which stays open (CLAUDE.md section 12). |

### Bootstrap fixtures (`scripts/bootstrap-fixtures`, `fixtures/bootstrap`)

| Decision | Rationale |
| --- | --- |
| Ships are looked up by exact `class_name` through `GET /api/vehicles?filter[class_name]=` and then fetched by uuid. | A display name resolves to special editions on the wiki (`DRAK_Cutlass_Black_BIS2950`, `RSI_Polaris_Collector_Military`). Identity is class_name (CLAUDE.md section 5). |
| The API's vocabulary is mapped by three explicit tables in `map.ts`: map to a model kind, keep as `other`, or exclude. **Any other type string halts**; `other` is never a fallback. | ADR-002 rule 5. `Port` has no `raw`, so a silently mapped `other` would lose the type for good. Excluded types are structure, interior fittings and controllers, not hardpoints. `LifeSupportGenerator` is kept as `other` because the model has no kind for it yet. |
| Only component ports (ItemType members other than `other`) carry a stock item and trigger an item fetch. `other` and `paint` ports keep their row with `default_item_class` null. | Items are components; attachments and paints are not. Keeps the pack honest and small. |
| Ambiguous API fields stay null with the originals in `raw`: `VehicleStats.hydrogen_fuel`, `quantum_fuel`; `ItemStats.power_draw`, `power_output`, `heat_generation`, `cooling_rate`, `em_signature`, `shield_delay`, `qd_range`, `qd_fuel_per_jump`. One-to-one fields are mapped; nothing is converted. | Picking one of a min/max pair or a downed/damage pair is an inference, which CLAUDE.md section 2 forbids. The Phase 1 normalizer decides from the game files. |
| The vehicle record's version is authoritative; a port or item version only has to agree when present. `first_seen_version` is the pack's version. | Some ports carry `version: null`. A present, different version still halts. |
| `GameVersion` in the pack: `is_current` true, `published_at` = pack build time, `manifest_url` = `fixtures/bootstrap/manifest.json`. | The bootstrap pack is its own publish. These are pipeline metadata, not game data. |
| Slugs: kebab-case of the display name; manufacturer-code prefix on collision; kebab-case `class_name` when the prefixed slug still collides (placeholder thrusters share one display name within a manufacturer); halt otherwise. | Data model, "Slugs and redirects", extended in this PR with the third step. |
| Rate: one serial queue at 2.5 s spacing that also gates retries (5, 20, 60 s on 429 and 5xx, three retries). | CLAUDE.md section 9 says 30 per minute and "never exceed"; retries outside the queue could. |
| `raw` keeps the pruned remainder of each record with locale objects collapsed to English. Raw API responses are not committed except three samples trimmed by rule for the mapper's tests. | Data-model principle 4 within the 2 MB cap. Vehicle responses run 200 to 450 KB each. |
| Rows are written one per line, sorted by primary key; volatile values live only in `GameVersion.json` and `manifest.json`. | Re-runs produce readable diffs. `buildPack` reproduces the committed files byte for byte from their own rows, and a test proves it. |

### Database package (`packages/db`)

| Decision | Rationale |
| --- | --- |
| drizzle-orm 0.45.4 and drizzle-kit 0.31.11, pinned exactly. | npm `latest`. Drizzle 1.0 is an `rc` with a different migration layout; the snapshot format is kit-version-bound. |
| "Derived from `packages/schema`" means: Postgres enums are built from the Zod enums at runtime; tables mirror the Zod fields with the field names as column names; `parity.test.ts` and the compile-time `type-parity.ts` fail if field set, name, nullability, enum members or row types drift. | The Zod types stay the only contract. drizzle-zod goes the other direction and would make a second source of truth. |
| `doublePrecision` for every `z.number()`, `integer` for `z.int()`, `bigint({ mode: "number" })` for `Model.bytes`, `uuid`, `text`, `text().array()`, `jsonb` for `raw`. | Exact JavaScript numbers; an int4 overflow fails loudly. |
| `isoTimestamp` custom column: `timestamptz` that travels as an ISO 8601 string both ways. | Drizzle's string mode returns Postgres text (`2026-01-01 00:00:00+00`), which the contract's `Timestamp` rejects. |
| Table names are the entity names in snake_case. Keys and uniques follow the data model; every versioned table also has a composite foreign key `(channel, game_version)` to `game_version`. | "No unversioned stat" becomes a database invariant, not a convention. |
| Reads the data model leaves open: `ContentItem` unique on `(source, external_id, revision)`; `EntityLink` keyed by `(content_item_id, entity_type, entity_key, char_start)`. | Append-only with revisions means one row per revision. Both are forward-changeable in a later migration. |
| PGlite (embedded Postgres) for unit tests and for local development when `DATABASE_URL` is unset (`packages/db/.pglite/`, git-ignored); postgres.js when it is set. One handle type, `Db`, for both. | Nothing to install, no Docker, no CI service; the same migrations and seed run against Neon later. |
| Migrations are applied by the runtime migrator in `src/migrate.ts`, never by `drizzle-kit push` or `migrate`. `drizzle.config.ts` holds no credentials. | One code path changes a database; forward-only by construction. |
| `0001_init` is produced by `drizzle-kit generate --name init` and renamed (file, snapshot, journal `idx` and `tag`). `drizzle-kit check` and a probe `generate` confirm the renamed snapshot is read as current; the next migration will be `0002_*`. | The spec names the migration; drizzle-kit has no start index option. |
| Seed semantics: identity rows (`Manufacturer`, `Vehicle`, `Item`) upsert only their mutable attributes, and only when something differs; `slug`, `slug_history` and `first_seen_version` are insert-only. Every other table is insert-if-absent, and an existing row with different values is drift that rolls the whole run back. The seed never flips `is_current` or sets `published_at`. | Slugs never change after first publish; published versions are immutable; the import job owns the pointer (CLAUDE.md section 5). A second run is a true no-op. |
| `packages/db` uses a `src/` folder, unlike `schema`. | `migrations/` resolves as `../migrations/` from both `src/` and `dist/`. |
| `pnpm db:migrate` and `pnpm db:seed` build `schema` first and run the package scripts; `generate` and `check` exist only inside `packages/db`. | The root script set is frozen to CLAUDE.md section 6 by a test. |

### Schema consumption (closes the ADR-003 question)

The root `typecheck` script builds `packages/schema` before type-checking anything, and Vitest aliases `schema` and `schema/env` to the TypeScript source so `pnpm test` needs no build and sees edits live. Runtime (tsx scripts, built workers, the web app) consumes `dist/`. One explicit rule, no `customConditions` split where TypeScript reads one file and Node another.

## Alternatives considered

| Option | Why not |
| --- | --- |
| drizzle-zod to derive Zod from Drizzle | Wrong direction: the Zod contract exists first and the pipeline validates against it without a database. |
| Docker Postgres for tests and local development | An install and a daemon on the owner's machine and a service on CI, for no capability PGlite lacks here. |
| `timestamp({ mode: "string" })` | Returns Postgres text, not ISO; every read would need a converter. |
| `numeric` for stats | Returns strings or needs a mode, buys nothing for JSON doubles. |
| Map unknown wiki types to `other` and report | Silent loss of the type string; contradicts "imports halt on unknown shapes". |
| Upsert every table on seed | Would overwrite a published version in place. |
| A `source` export condition with `customConditions` | Three config surfaces and a silent source/dist split. |
| Look ships up by display name | Resolves to special editions. |
| Qualify `port_name` with its parent instead of adding `port_path` | `port_name` would stop being the game's port name, which the model promises. |
| 2 s request spacing | 30 per minute exactly; a retry would exceed the cap. |

## Consequences

- Every later pack producer (pipeline publish, import job) writes and validates the same `Manifest` and `parsePack`; the Phase 1 normalizers get fixtures-first tests for free.
- The Phase 1 normalizer must define the fields left null here and decide where `LifeSupportGenerator` and the excluded structural types belong; that is a data-model change with its own ADR if a new `ItemType` is added.
- `fixtures/bootstrap` is regenerated only by the script; a hand edit breaks the byte-for-byte rebuild test. The credit line must display on every page that shows this data until Phase 1 replaces it.
- The next migration is `0002_<name>`; `pnpm --filter db check` runs in the `check` CI job through `pnpm test`'s migration test, which also asserts there is exactly one migration until a later PR adds one.
- Neon: use the direct (non-pooled) connection string for migrations; postgres.js is used with `max: 1` for the CLIs.
- Unit tests start a WASM Postgres per test file; hooks that open one use a 30 s timeout for cold CI starts.
