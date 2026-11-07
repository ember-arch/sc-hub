import { describe, expect, it } from "vitest";
import { type EntityName, PackError, entityNames } from "../index.js";
import { parsePack, sha256Hex, utf8Bytes } from "../pack.js";
import { loadFixture } from "./helpers.js";

// A pack built from the synthetic fixtures in fixtures/schema is self-contained: TEST_Example is
// made by TEST, carries TEST_Item on its one port, and every versioned row is LIVE 0.0.1-test.1.

type Row = Record<string, unknown>;
type Rows = Partial<Record<EntityName, Row[]>>;

function synthetic(): Rows {
  return Object.fromEntries(
    entityNames.map((entity) => [entity, [loadFixture(entity)]]),
  ) as Rows;
}

function makePack(rows: Rows, manifestOverrides: Row = {}) {
  const files = new Map<string, string>();
  const entries = Object.entries(rows).map(([entity, list]) => {
    const name = `${entity}.json`;
    const text = JSON.stringify(list);
    files.set(name, text);
    return {
      name,
      entity,
      sha256: sha256Hex(text),
      bytes: utf8Bytes(text),
      count: list.length,
    };
  });
  const manifest = {
    schema_version: 1,
    channel: "LIVE",
    game_version: "0.0.1-test.1",
    created_at: "2026-01-01T00:00:00.000Z",
    source: "test",
    source_url: null,
    credit: null,
    files: entries,
    ...manifestOverrides,
  };
  return {
    manifestText: JSON.stringify(manifest),
    files,
    read: (name: string) => files.get(name),
  };
}

function failure(fn: () => unknown): PackError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(PackError);
    return error as PackError;
  }
  throw new Error("expected parsePack to throw");
}

describe("parsePack", () => {
  it("parses the synthetic pack with one row per entity", () => {
    const { manifestText, read } = makePack(synthetic());
    const pack = parsePack(manifestText, read);
    for (const entity of entityNames) {
      expect(pack.rows[entity]).toHaveLength(1);
    }
    expect(pack.manifest.game_version).toBe("0.0.1-test.1");
    expect(pack.rows.Vehicle[0]?.class_name).toBe("TEST_Example");
  });

  it("accepts a pack that holds only some entities", () => {
    const rows = synthetic();
    const { manifestText, read } = makePack({
      GameVersion: rows.GameVersion ?? [],
      Manufacturer: rows.Manufacturer ?? [],
    });
    const pack = parsePack(manifestText, read);
    expect(pack.rows.Vehicle).toEqual([]);
    expect(pack.rows.Manufacturer).toHaveLength(1);
  });

  it("rejects a manifest that is not valid or not a Manifest", () => {
    const { read } = makePack(synthetic());
    expect(failure(() => parsePack("{", read)).details.file).toBe(
      "manifest.json",
    );
    expect(
      failure(() => parsePack(JSON.stringify({ files: [] }), read)).message,
    ).toContain("Manifest type");
  });

  it("names a listed file that is missing", () => {
    const { manifestText, files, read } = makePack(synthetic());
    files.delete("Item.json");
    const error = failure(() => parsePack(manifestText, read));
    expect(error.details).toMatchObject({ file: "Item.json", entity: "Item" });
  });

  it("rejects a byte count or checksum that does not match", () => {
    const longer = makePack(synthetic());
    const text = longer.files.get("Vehicle.json") ?? "";
    longer.files.set("Vehicle.json", `${text} `);
    expect(
      failure(() => parsePack(longer.manifestText, longer.read)).message,
    ).toContain("bytes");

    const tampered = makePack(synthetic());
    const original = tampered.files.get("Vehicle.json") ?? "";
    tampered.files.set("Vehicle.json", original.replace("Example", "Exampel"));
    expect(
      failure(() => parsePack(tampered.manifestText, tampered.read)).message,
    ).toContain("sha256");
  });

  it("rejects a row count that does not match the manifest", () => {
    const { manifestText, read } = makePack(synthetic());
    const manifest = JSON.parse(manifestText) as { files: Row[] };
    const vehicle = manifest.files.find((f) => f["entity"] === "Vehicle");
    if (vehicle) vehicle["count"] = 2;
    expect(
      failure(() => parsePack(JSON.stringify(manifest), read)).message,
    ).toContain("rows");
  });

  it("rejects an entity listed twice", () => {
    const { manifestText, read } = makePack(synthetic());
    const manifest = JSON.parse(manifestText) as { files: Row[] };
    manifest.files.push({ ...(manifest.files[0] ?? {}) });
    expect(
      failure(() => parsePack(JSON.stringify(manifest), read)).message,
    ).toContain("twice");
  });

  it("points at the row and field that fail validation", () => {
    const rows = synthetic();
    rows.Vehicle = [{ ...(rows.Vehicle?.[0] ?? {}), extra: 1 }];
    const { manifestText, read } = makePack(rows);
    const error = failure(() => parsePack(manifestText, read));
    expect(error.details).toMatchObject({ entity: "Vehicle", index: 0 });
    expect(error.message).toContain("extra");
  });

  it("rejects two rows with the same primary key", () => {
    const rows = synthetic();
    const port = rows.Port?.[0] ?? {};
    rows.Port = [port, { ...port, size_max: 2 }];
    const { manifestText, read } = makePack(rows);
    expect(failure(() => parsePack(manifestText, read)).message).toContain(
      "repeats the primary key",
    );
  });

  it("rejects versioned rows from another channel or version", () => {
    const rows = synthetic();
    rows.ItemStats = [
      { ...(rows.ItemStats?.[0] ?? {}), game_version: "9.9.9" },
    ];
    const { manifestText, read } = makePack(rows);
    const error = failure(() => parsePack(manifestText, read));
    expect(error.details).toMatchObject({ entity: "ItemStats", index: 0 });

    const other = synthetic();
    other.GameVersion = [{ ...(other.GameVersion?.[0] ?? {}), channel: "PTU" }];
    const built = makePack(other);
    expect(
      failure(() => parsePack(built.manifestText, built.read)).details.entity,
    ).toBe("GameVersion");
  });

  it.each([
    ["Vehicle", "manufacturer_code", "NOPE", "Manufacturer.code"],
    ["Vehicle", "base_variant_of", "TEST_Missing", "Vehicle.class_name"],
    ["Item", "manufacturer_code", "NOPE", "Manufacturer.code"],
    ["VehicleStats", "class_name", "TEST_Missing", "Vehicle.class_name"],
    ["Port", "default_item_class", "TEST_Missing", "Item.class_name"],
    [
      "Port",
      "parent_port_path",
      "hardpoint_missing",
      "Port on the same vehicle",
    ],
    ["ItemStats", "class_name", "TEST_Missing", "Item.class_name"],
    ["Paint", "class_name", "TEST_Missing", "Vehicle.class_name"],
    ["Model", "class_name", "TEST_Missing", "Vehicle.class_name"],
    [
      "ContentItem",
      "author_id",
      "0b6a1c6e-2f1b-4c0a-9d3e-6f2a9c1e7b10",
      "Author.id",
    ],
    [
      "EntityLink",
      "content_item_id",
      "0b6a1c6e-2f1b-4c0a-9d3e-6f2a9c1e7b10",
      "ContentItem.id",
    ],
  ] as const)(
    "rejects %s.%s that points outside the pack",
    (entity, field, value, target) => {
      const rows = synthetic();
      rows[entity] = [{ ...(rows[entity]?.[0] ?? {}), [field]: value }];
      const { manifestText, read } = makePack(rows);
      const error = failure(() => parsePack(manifestText, read));
      expect(error.details).toMatchObject({ entity, index: 0, path: field });
      expect(error.message).toContain(target);
    },
  );

  it("rejects duplicate slugs, handles and version strings", () => {
    const rows = synthetic();
    const vehicle = rows.Vehicle?.[0] ?? {};
    rows.Vehicle = [vehicle, { ...vehicle, class_name: "TEST_Other" }];
    const { manifestText, read } = makePack(rows);
    const error = failure(() => parsePack(manifestText, read));
    expect(error.details).toMatchObject({ entity: "Vehicle", path: "slug" });
  });
});
