import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { type EntityName, entityNames, enums, registry } from "schema";
import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { pgEnums, seedOrder, tables } from "../src/schema/index.js";

// "Derived from packages/schema" is enforced here: a table that drifts from its Zod type in field
// set, column name, nullability or enum members fails this file.

const snakeCase = (name: string): string =>
  name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const tableToEntity = new Map<string, EntityName>(
  entityNames.map((entity) => [getTableName(tables[entity]), entity]),
);

describe("tables mirror the schema", () => {
  it.each(entityNames)(
    "%s has exactly the contract's fields with the same names and nullability",
    (entity) => {
      const columns = getTableColumns(tables[entity]);
      const shape = registry[entity].shape as Record<string, z.ZodType>;
      expect(Object.keys(columns).sort()).toEqual(Object.keys(shape).sort());
      for (const [key, column] of Object.entries(columns)) {
        expect(column.name, `${entity}.${key} column name`).toBe(key);
        const nullable = shape[key]?.safeParse(null).success ?? false;
        expect(column.notNull, `${entity}.${key} not null`).toBe(!nullable);
      }
    },
  );

  it.each(entityNames)(
    "%s is a snake_case table of the same name",
    (entity) => {
      expect(getTableName(tables[entity])).toBe(snakeCase(entity));
    },
  );

  it.each(Object.keys(enums) as (keyof typeof enums)[])(
    "Postgres enum %s has the Zod members in order",
    (name) => {
      expect(pgEnums[name].enumValues).toEqual(enums[name].options);
    },
  );

  it("every enum column carries the members of one Zod enum", () => {
    const known = new Set(
      Object.values(enums).map((zodEnum) => JSON.stringify(zodEnum.options)),
    );
    let enumColumns = 0;
    for (const entity of entityNames) {
      for (const column of Object.values(getTableColumns(tables[entity]))) {
        if (column.enumValues === undefined) continue;
        enumColumns += 1;
        expect(known.has(JSON.stringify(column.enumValues))).toBe(true);
      }
    }
    expect(enumColumns).toBeGreaterThan(0);
  });

  it("seedOrder lists every entity once", () => {
    expect([...seedOrder].sort()).toEqual([...entityNames].sort());
  });

  it("seedOrder places every referenced table before the tables that reference it", () => {
    for (const entity of entityNames) {
      const table = tables[entity];
      for (const fk of getTableConfig(table).foreignKeys) {
        const target = getTableName(fk.reference().foreignTable);
        if (target === getTableName(table)) continue;
        const targetEntity = tableToEntity.get(target);
        expect(targetEntity, `${entity} references ${target}`).toBeDefined();
        if (targetEntity === undefined) continue;
        expect(
          seedOrder.indexOf(targetEntity),
          `${targetEntity} must seed before ${entity}`,
        ).toBeLessThan(seedOrder.indexOf(entity));
      }
    }
  });
});

// The SQL type of every column follows the Zod field: an integer field that became double precision
// (or the reverse) passes the TypeScript check, because both are `number`, so this test reads the
// Zod definition and the Drizzle column type directly.
type ZodDef = { type: string; format?: string; innerType?: unknown };
const defOf = (schema: unknown): ZodDef => (schema as { def: ZodDef }).def;

function unwrap(schema: unknown): ZodDef {
  let def = defOf(schema);
  while (
    (def.type === "nullable" || def.type === "optional") &&
    def.innerType !== undefined
  ) {
    def = defOf(def.innerType);
  }
  return def;
}

function allowedColumnTypes(def: ZodDef): string[] {
  switch (def.type) {
    case "number":
      return def.format === "safeint" || def.format === "int32"
        ? ["PgInteger", "PgBigInt53"]
        : ["PgDoublePrecision"];
    case "boolean":
      return ["PgBoolean"];
    case "string":
      if (def.format === "uuid") return ["PgUUID"];
      if (def.format === "datetime") return ["PgCustomColumn"];
      return ["PgText"];
    case "enum":
      return ["PgEnumColumn"];
    case "array":
      return ["PgArray"];
    case "record":
      return ["PgJsonb"];
    default:
      return [];
  }
}

describe("SQL column types follow the Zod field types", () => {
  it.each(entityNames)("%s", (entity) => {
    const columns = getTableColumns(tables[entity]);
    const shape = registry[entity].shape as Record<string, unknown>;
    for (const [key, column] of Object.entries(columns)) {
      const def = unwrap(shape[key]);
      const allowed = allowedColumnTypes(def);
      expect(
        allowed,
        `${entity}.${key}: no rule for Zod type ${def.type}`,
      ).not.toHaveLength(0);
      expect(allowed, `${entity}.${key} is ${column.columnType}`).toContain(
        column.columnType,
      );
    }
  });
});
