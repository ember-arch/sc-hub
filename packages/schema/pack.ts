import { createHash } from "node:crypto";
import type { ZodError } from "zod";
import { type Entity, primaryKeyOf } from "./keys.js";
import { Manifest } from "./manifest.js";
import { PackError, type DataPack, type PackRows } from "./pack-types.js";
import { type EntityName, entityNames, registry } from "./registry.js";

/**
 * A data pack is a manifest plus one JSON array per entity (CLAUDE.md section 11). This module is
 * the single place that decides whether a pack is valid: the bootstrap fixtures, the pipeline's
 * publish step, the import job and the database seed all call `parsePack` and refuse anything it
 * rejects, so an unknown shape halts before it can land anywhere (ADR-002 rule 5).
 *
 * A pack is self-contained: every reference inside it resolves inside it.
 */

export {
  PackError,
  type DataPack,
  type PackErrorDetails,
  type PackRows,
} from "./pack-types.js";

/** Returns a pack file's UTF-8 text by its manifest name, or undefined when it does not exist. */
export type PackReader = (name: string) => string | undefined;

export function sha256Hex(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

export function utf8Bytes(content: string): number {
  return Buffer.byteLength(content, "utf8");
}

export function describeIssues(error: ZodError): string {
  return error.issues
    .slice(0, 3)
    .map(
      (issue) =>
        `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`,
    )
    .join("; ");
}

function emptyRows(): PackRows {
  return Object.fromEntries(
    entityNames.map((name) => [name, []]),
  ) as unknown as PackRows;
}

function parseJson(text: string, file: string, entity?: EntityName): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new PackError(
      `${file} is not valid JSON`,
      entity === undefined ? { file } : { file, entity },
    );
  }
}

/**
 * Validates and parses a whole pack. Throws `PackError` on the first problem; nothing partial is
 * returned. Checks, in order: the manifest shape; for each listed file its presence, byte length,
 * sha256, row count and every row against its entity type; duplicate primary keys; that every
 * versioned row belongs to the manifest's channel and game version; that every reference resolves
 * inside the pack; and the uniqueness rules the data model states.
 */
export function parsePack(manifestText: string, read: PackReader): DataPack {
  const manifestResult = Manifest.safeParse(
    parseJson(manifestText, "manifest.json"),
  );
  if (!manifestResult.success) {
    throw new PackError(
      `manifest.json does not match the Manifest type: ${describeIssues(manifestResult.error)}`,
      { file: "manifest.json" },
    );
  }
  const manifest = manifestResult.data;
  const rows = emptyRows();
  const seen = new Set<EntityName>();

  for (const file of manifest.files) {
    const { name, entity } = file;
    if (seen.has(entity)) {
      throw new PackError(`entity ${entity} is listed twice in the manifest`, {
        file: name,
        entity,
      });
    }
    seen.add(entity);

    const text = read(name);
    if (text === undefined) {
      throw new PackError(`${name} is listed in the manifest but missing`, {
        file: name,
        entity,
      });
    }
    const bytes = utf8Bytes(text);
    if (bytes !== file.bytes) {
      throw new PackError(
        `${name}: manifest says ${file.bytes} bytes, file has ${bytes}`,
        { file: name, entity },
      );
    }
    const digest = sha256Hex(text);
    if (digest !== file.sha256) {
      throw new PackError(
        `${name}: sha256 mismatch (manifest ${file.sha256}, file ${digest})`,
        { file: name, entity },
      );
    }

    const parsed = parseJson(text, name, entity);
    if (!Array.isArray(parsed)) {
      throw new PackError(`${name} must be a JSON array of ${entity} rows`, {
        file: name,
        entity,
      });
    }
    if (parsed.length !== file.count) {
      throw new PackError(
        `${name}: manifest says ${file.count} rows, file has ${parsed.length}`,
        { file: name, entity },
      );
    }

    const schema = registry[entity];
    const keys = new Map<string, number>();
    const out: Entity<EntityName>[] = [];
    parsed.forEach((raw: unknown, index: number) => {
      const result = schema.safeParse(raw);
      if (!result.success) {
        const issue = result.error.issues[0];
        throw new PackError(
          `${entity}[${index}] fails validation: ${describeIssues(result.error)}`,
          {
            file: name,
            entity,
            index,
            path: issue?.path.map(String).join(".") ?? "",
          },
        );
      }
      const row = result.data as Entity<EntityName>;
      const key = primaryKeyOf(entity, row);
      const earlier = keys.get(key);
      if (earlier !== undefined) {
        throw new PackError(
          `${entity}[${index}] repeats the primary key of ${entity}[${earlier}]`,
          { file: name, entity, index },
        );
      }
      keys.set(key, index);
      out.push(row);
    });
    (rows as Record<EntityName, unknown[]>)[entity] = out;
  }

  checkVersions(manifest, rows);
  checkReferences(rows);
  checkUniqueness(rows);
  return { manifest, rows };
}

const versionedEntities = [
  "VehicleStats",
  "Port",
  "ItemStats",
  "Model",
] as const;

function checkVersions(manifest: Manifest, rows: PackRows): void {
  for (const entity of versionedEntities) {
    rows[entity].forEach((row, index) => {
      if (
        row.channel !== manifest.channel ||
        row.game_version !== manifest.game_version
      ) {
        throw new PackError(
          `${entity}[${index}] belongs to ${row.channel} ${row.game_version}, not to the pack's ${manifest.channel} ${manifest.game_version}`,
          { entity, index, path: "game_version" },
        );
      }
    });
  }
  rows.GameVersion.forEach((row, index) => {
    if (
      row.channel !== manifest.channel ||
      row.version !== manifest.game_version
    ) {
      throw new PackError(
        `GameVersion[${index}] is ${row.channel} ${row.version}, not the pack's ${manifest.channel} ${manifest.game_version}`,
        { entity: "GameVersion", index, path: "version" },
      );
    }
  });
}

function expectRef(
  entity: EntityName,
  index: number,
  path: string,
  value: string | null,
  targets: ReadonlySet<string>,
  target: string,
): void {
  if (value !== null && !targets.has(value)) {
    throw new PackError(
      `${entity}[${index}].${path} = ${JSON.stringify(value)} does not match any ${target} in the pack`,
      { entity, index, path },
    );
  }
}

function checkReferences(rows: PackRows): void {
  const manufacturers = new Set(rows.Manufacturer.map((row) => row.code));
  const vehicles = new Set(rows.Vehicle.map((row) => row.class_name));
  const items = new Set(rows.Item.map((row) => row.class_name));
  const authors = new Set(rows.Author.map((row) => row.id));
  const contentItems = new Set(rows.ContentItem.map((row) => row.id));
  const ports = new Set(
    rows.Port.map((row) => `${row.class_name}|${row.port_path}`),
  );

  rows.Vehicle.forEach((row, i) => {
    expectRef(
      "Vehicle",
      i,
      "manufacturer_code",
      row.manufacturer_code,
      manufacturers,
      "Manufacturer.code",
    );
    expectRef(
      "Vehicle",
      i,
      "base_variant_of",
      row.base_variant_of,
      vehicles,
      "Vehicle.class_name",
    );
  });
  rows.Item.forEach((row, i) => {
    expectRef(
      "Item",
      i,
      "manufacturer_code",
      row.manufacturer_code,
      manufacturers,
      "Manufacturer.code",
    );
  });
  rows.VehicleStats.forEach((row, i) => {
    expectRef(
      "VehicleStats",
      i,
      "class_name",
      row.class_name,
      vehicles,
      "Vehicle.class_name",
    );
  });
  rows.Port.forEach((row, i) => {
    expectRef(
      "Port",
      i,
      "class_name",
      row.class_name,
      vehicles,
      "Vehicle.class_name",
    );
    expectRef(
      "Port",
      i,
      "default_item_class",
      row.default_item_class,
      items,
      "Item.class_name",
    );
    if (row.parent_port_path !== null) {
      expectRef(
        "Port",
        i,
        "parent_port_path",
        `${row.class_name}|${row.parent_port_path}`,
        ports,
        "Port on the same vehicle",
      );
    }
    // The path is derived from the parent's path and the game's port name, nothing else.
    const expectedPath =
      row.parent_port_path === null
        ? row.port_name
        : `${row.parent_port_path}/${row.port_name}`;
    if (row.port_path !== expectedPath) {
      throw new PackError(
        `Port[${i}].port_path = ${JSON.stringify(row.port_path)} should be ${JSON.stringify(expectedPath)} (parent path plus port name)`,
        { entity: "Port", index: i, path: "port_path" },
      );
    }
  });
  rows.ItemStats.forEach((row, i) => {
    expectRef(
      "ItemStats",
      i,
      "class_name",
      row.class_name,
      items,
      "Item.class_name",
    );
  });
  rows.Paint.forEach((row, i) => {
    expectRef(
      "Paint",
      i,
      "class_name",
      row.class_name,
      vehicles,
      "Vehicle.class_name",
    );
  });
  rows.Model.forEach((row, i) => {
    expectRef(
      "Model",
      i,
      "class_name",
      row.class_name,
      vehicles,
      "Vehicle.class_name",
    );
  });
  rows.ContentItem.forEach((row, i) => {
    expectRef(
      "ContentItem",
      i,
      "author_id",
      row.author_id,
      authors,
      "Author.id",
    );
  });
  rows.EntityLink.forEach((row, i) => {
    expectRef(
      "EntityLink",
      i,
      "content_item_id",
      row.content_item_id,
      contentItems,
      "ContentItem.id",
    );
  });
}

function expectUnique<K extends EntityName>(
  entity: K,
  rows: Entity<K>[],
  path: string,
  keyOf: (row: Entity<K>) => string,
): void {
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = keyOf(row);
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      throw new PackError(
        `${entity}[${index}].${path} repeats the value of ${entity}[${earlier}]`,
        { entity, index, path },
      );
    }
    seen.set(key, index);
  });
}

function checkUniqueness(rows: PackRows): void {
  expectUnique("Vehicle", rows.Vehicle, "slug", (row) => row.slug);
  expectUnique("Item", rows.Item, "slug", (row) => row.slug);
  expectUnique("Manufacturer", rows.Manufacturer, "slug", (row) => row.slug);
  expectUnique("Author", rows.Author, "handle", (row) => row.handle);
  expectUnique(
    "GameVersion",
    rows.GameVersion,
    "channel+version",
    (row) => `${row.channel}|${row.version}`,
  );
  expectUnique(
    "ContentItem",
    rows.ContentItem,
    "source+external_id+revision",
    (row) => `${row.source}|${row.external_id}|${row.revision}`,
  );
}
