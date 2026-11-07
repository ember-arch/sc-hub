import { and, eq, getTableColumns, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { type DataPack, type EntityName, primaryKeys } from "schema";
import type { Db } from "./client.js";
import type { Logger } from "./log.js";
import { seedOrder, tables } from "./schema/index.js";

/**
 * Loads a validated data pack into the database in one transaction, in foreign-key order.
 *
 * Identity rows (Manufacturer, Vehicle, Item) are upserted, but only their mutable attributes
 * change: keys, slugs and first-publish fields are insert-only because slugs never change after
 * first publish (CLAUDE.md section 5). Everything else is versioned or append-only and is
 * inserted only if absent; a row that already exists with different values is drift, and drift
 * rolls the whole run back, because published versions are immutable. The seed never flips
 * `is_current` or sets `published_at`; the import job owns the pointer.
 */

export interface EntityCounts {
  readonly in: number;
  readonly inserted: number;
  readonly updated: number;
  readonly unchanged: number;
}

export type SeedCounts = Record<EntityName, EntityCounts>;

export interface SeedResult {
  readonly counts: SeedCounts;
  readonly duration_ms: number;
}

export class SeedDriftError extends Error {
  readonly entity: EntityName;
  readonly key: string;
  readonly field: string;

  constructor(entity: EntityName, key: string, field: string) {
    super(
      `${entity} ${key} already exists with a different ${field}. Published versions are immutable; a fix is a new version (CLAUDE.md section 5).`,
    );
    this.name = "SeedDriftError";
    this.entity = entity;
    this.key = key;
    this.field = field;
  }
}

/** Identity entities and the attributes a later pack may change. Everything not listed is insert-only. */
const MUTABLE: Partial<Record<EntityName, readonly string[]>> = {
  Manufacturer: ["name", "description", "logo_asset"],
  Vehicle: [
    "name",
    "manufacturer_code",
    "kind",
    "status",
    "role",
    "size_class",
    "base_variant_of",
    "is_hero",
  ],
  Item: [
    "name",
    "manufacturer_code",
    "type",
    "subtype",
    "size",
    "grade",
    "item_class",
  ],
};

const CHUNK = 500;
const ZERO: EntityCounts = { in: 0, inserted: 0, updated: 0, unchanged: 0 };

type Row = Record<string, unknown>;

function columnsOf(table: PgTable): Record<string, PgColumn> {
  return getTableColumns(table) as Record<string, PgColumn>;
}

function column(
  columns: Record<string, PgColumn>,
  field: string,
  entity: EntityName,
): PgColumn {
  const found = columns[field];
  if (found === undefined) {
    throw new Error(`${entity} has no column named ${field}`);
  }
  return found;
}

function keyOf(entity: EntityName, row: Row): string {
  return primaryKeys[entity]
    .map((field) => JSON.stringify(row[field]))
    .join("|");
}

function* chunks<T>(list: readonly T[]): Generator<readonly T[]> {
  for (let start = 0; start < list.length; start += CHUNK) {
    yield list.slice(start, start + CHUNK);
  }
}

const ISO_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A string that is equal exactly when two values mean the same thing to the database. */
function canonical(value: unknown): string {
  if (typeof value === "string" && ISO_PREFIX.test(value)) {
    const time = Date.parse(value);
    if (!Number.isNaN(time)) return `date:${time}`;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Row;
    const body = Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function firstDifference(stored: Row, incoming: Row): string | null {
  for (const field of Object.keys(incoming)) {
    if (canonical(stored[field]) !== canonical(incoming[field])) return field;
  }
  return null;
}

async function upsertIdentity(
  db: Db,
  entity: EntityName,
  table: PgTable,
  rows: readonly Row[],
  mutable: readonly string[],
): Promise<EntityCounts> {
  const columns = columnsOf(table);
  const target = primaryKeys[entity].map((field) =>
    column(columns, field, entity),
  );
  const set = Object.fromEntries(
    mutable.map((field) => [field, sql`excluded.${sql.identifier(field)}`]),
  );
  // Only rows whose mutable attributes differ are updated, so an identical re-run writes nothing.
  const changed = sql.join(
    mutable.map(
      (field) =>
        sql`${column(columns, field, entity)} is distinct from excluded.${sql.identifier(field)}`,
    ),
    sql` or `,
  );
  let inserted = 0;
  let updated = 0;
  for (const chunk of chunks(rows)) {
    const returned = await db
      .insert(table)
      .values(chunk as Row[])
      .onConflictDoUpdate({ target, set, setWhere: changed })
      .returning({ inserted: sql<boolean>`(xmax = 0)` });
    for (const row of returned) {
      if (row.inserted) inserted += 1;
      else updated += 1;
    }
  }
  return {
    in: rows.length,
    inserted,
    updated,
    unchanged: rows.length - inserted - updated,
  };
}

async function insertImmutable(
  db: Db,
  entity: EntityName,
  table: PgTable,
  rows: readonly Row[],
): Promise<EntityCounts> {
  const columns = columnsOf(table);
  const fields = primaryKeys[entity];
  const target = fields.map((field) => column(columns, field, entity));
  const returning = Object.fromEntries(
    fields.map((field) => [field, column(columns, field, entity)]),
  );
  let inserted = 0;
  const skipped: Row[] = [];
  for (const chunk of chunks(rows)) {
    const returned = await db
      .insert(table)
      .values(chunk as Row[])
      .onConflictDoNothing({ target })
      .returning(returning);
    const insertedKeys = new Set(
      returned.map((row) => keyOf(entity, row as Row)),
    );
    inserted += returned.length;
    for (const row of chunk) {
      if (!insertedKeys.has(keyOf(entity, row))) skipped.push(row);
    }
  }
  // A skipped row must be byte-for-byte the row already stored; anything else is drift.
  for (const row of skipped) {
    const where = and(
      ...fields.map((field) => eq(column(columns, field, entity), row[field])),
    );
    const [stored] = await db.select().from(table).where(where).limit(1);
    if (stored === undefined) {
      throw new Error(
        `${entity} ${keyOf(entity, row)} was neither inserted nor found`,
      );
    }
    const field = firstDifference(stored as Row, row);
    if (field !== null) {
      throw new SeedDriftError(entity, keyOf(entity, row), field);
    }
  }
  return {
    in: rows.length,
    inserted,
    updated: 0,
    unchanged: skipped.length,
  };
}

export async function seedPack(
  db: Db,
  pack: DataPack,
  log: Logger,
): Promise<SeedResult> {
  const started = Date.now();
  const counts = {} as SeedCounts;
  await db.transaction(async (tx) => {
    for (const entity of seedOrder) {
      const rows = pack.rows[entity] as readonly Row[];
      const table: PgTable = tables[entity];
      const mutable = MUTABLE[entity];
      let result: EntityCounts;
      if (rows.length === 0) result = ZERO;
      else if (mutable !== undefined) {
        result = await upsertIdentity(tx, entity, table, rows, mutable);
      } else result = await insertImmutable(tx, entity, table, rows);
      counts[entity] = result;
      log.info({ event: "db.seed.entity", entity, ...result });
    }
  });
  return { counts, duration_ms: Date.now() - started };
}
