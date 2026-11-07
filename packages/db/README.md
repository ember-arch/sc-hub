# packages/db

Drizzle tables derived from `packages/schema`, forward-only migrations, and the seed that loads a data pack. Spec 00, criterion "Database package"; decisions in `docs/decisions/ADR-004-db-and-fixtures.md`.

## What "derived from the schema" means here

The Zod types in `packages/schema` are the contract. The tables in `src/schema/` mirror them field for field: column keys are the contract's field names, Postgres enums are built from the Zod enums at runtime, and `__tests__/parity.test.ts` plus the compile-time checks in `__tests__/type-parity.ts` fail the build if the two ever drift. Keys, uniques and foreign keys follow `docs/data-model.md`; every stat table also carries a composite foreign key to `game_version`, so "no unversioned stat" is a database invariant.

## Which database

- `DATABASE_URL` set: that Postgres, through postgres.js. Use Neon's direct (non-pooled) connection string for migrations.
- `DATABASE_URL` unset: an embedded PGlite database in `packages/db/.pglite/` (git-ignored). Nothing to install. Unit tests use in-memory PGlite and never touch a folder.

## Commands

| Command | Does |
| --- | --- |
| `pnpm db:migrate` (root) | Applies every unapplied migration in `migrations/`. Idempotent. |
| `pnpm db:seed [--pack <dir>]` (root) | Migrates, validates the pack with `parsePack`, loads it in one transaction. Defaults to `fixtures/bootstrap`. A second run is a no-op; a row that already exists with different values halts the run. |
| `pnpm --filter db generate --name <name>` | Writes a new migration from the tables. One migration per PR at most, forward-only. |
| `pnpm --filter db check` | Verifies the migration snapshots are consistent. |

Never use `drizzle-kit push` or `drizzle-kit migrate`: the runtime migrator in `src/migrate.ts` is the only thing that changes a database, and `drizzle.config.ts` holds no credentials on purpose.

## Seeding rules

Identity rows (`Manufacturer`, `Vehicle`, `Item`) are upserted, but only their mutable attributes change; `slug`, `slug_history` and `first_seen_version` are insert-only because slugs never change after first publish. Every other table is versioned or append-only: rows are inserted only if absent, and an existing row with different values is drift, which rolls the whole run back. The seed never flips `is_current` or sets `published_at`; the Phase 1 import job owns the channel pointer.
