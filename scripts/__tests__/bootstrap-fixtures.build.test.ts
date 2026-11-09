import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Manifest, type Vehicle } from "schema";
import { parsePack, utf8Bytes } from "schema/pack";
import { describe, expect, it } from "vitest";
import {
  BuildError,
  PACK_BYTE_LIMIT,
  PACK_ENTITIES,
  WIKI_CREDIT_LINE,
  WIKI_SOURCE_URL,
  buildPack,
  checkFiveShips,
  renderRows,
  trimItemSample,
  trimVehicleSample,
} from "../bootstrap-fixtures/build.js";

const packDir = fileURLToPath(
  new URL("../../fixtures/bootstrap/", import.meta.url),
);
const read = (name: string): string | undefined => {
  try {
    return readFileSync(join(packDir, name), "utf8");
  } catch {
    return undefined;
  }
};

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe("the committed bootstrap pack", () => {
  const manifestText = read("manifest.json") ?? "";
  const pack = parsePack(manifestText, read);

  it("stays under the pack's size cap and parses as a data pack", () => {
    const bytes = filesUnder(packDir).reduce(
      (sum, path) => sum + statSync(path).size,
      0,
    );
    expect(bytes).toBeLessThan(PACK_BYTE_LIMIT);
    expect(pack.rows.Vehicle.length).toBeGreaterThanOrEqual(6);
  });

  it("holds at least five ships of five sizes from five manufacturers", () => {
    expect(() => checkFiveShips(pack.rows.Vehicle)).not.toThrow();
    expect(
      new Set(pack.rows.Vehicle.map((v) => v.size_class)).size,
    ).toBeGreaterThanOrEqual(5);
    expect(
      new Set(pack.rows.Vehicle.map((v) => v.manufacturer_code)).size,
    ).toBeGreaterThanOrEqual(5);
  });

  it("records the wiki credit line verbatim in the manifest and the README", () => {
    expect(pack.manifest.credit).toBe(WIKI_CREDIT_LINE);
    expect(pack.manifest.source).toBe("wiki-bootstrap");
    expect(pack.manifest.source_url).toBe(WIKI_SOURCE_URL);
    expect(read("README.md")).toContain(WIKI_CREDIT_LINE);
  });

  it("is reproduced byte for byte by buildPack from its own rows", () => {
    const built = buildPack({
      rows: pack.rows,
      createdAt: pack.manifest.created_at,
      extras: new Map(),
    });
    for (const entity of PACK_ENTITIES) {
      expect(built.files.get(`${entity}.json`), entity).toBe(
        read(`${entity}.json`),
      );
    }
    expect(built.files.get("manifest.json")).toBe(manifestText);
  });

  it("carries one GameVersion that is current and matches the manifest", () => {
    const [gameVersion] = pack.rows.GameVersion;
    expect(gameVersion?.is_current).toBe(true);
    expect(gameVersion?.version).toBe(pack.manifest.game_version);
    expect(gameVersion?.manifest_url).toBe("fixtures/bootstrap/manifest.json");
  });

  it("has a trimmed sample that trims to itself", () => {
    const vehicle = JSON.parse(read("samples/vehicle.json") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(trimVehicleSample(vehicle)).toEqual(vehicle);
    const item = JSON.parse(read("samples/item-weapon.json") ?? "{}") as Record<
      string,
      unknown
    >;
    expect(trimItemSample(item)).toEqual(item);
  });
});

describe("buildPack rules", () => {
  const manifestText = read("manifest.json") ?? "";
  const pack = parsePack(manifestText, read);

  it("halts when the pack would exceed the byte limit", () => {
    const extras = new Map([
      ["samples/huge.json", "x".repeat(PACK_BYTE_LIMIT)],
    ]);
    expect(() =>
      buildPack({
        rows: pack.rows,
        createdAt: pack.manifest.created_at,
        extras,
      }),
    ).toThrow(BuildError);
  });

  it("halts when the ships do not span five sizes and manufacturers", () => {
    const [a, b, c, d] = pack.rows.Vehicle;
    if (!a || !b || !c || !d) throw new Error("pack has fewer than four ships");
    expect(() => checkFiveShips([a, b, c, d])).toThrow(BuildError);
    expect(() =>
      checkFiveShips([a, b, c, d, { ...a, class_name: "X" }]),
    ).toThrow(BuildError);
  });

  it("renders rows sorted by primary key, one per line", () => {
    const [a, b] = pack.rows.Vehicle;
    if (!a || !b) throw new Error("pack has fewer than two ships");
    const text = renderRows("Vehicle", [b, a]);
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("[");
    expect(lines.at(-1)).toBe("]");
    const parsed = JSON.parse(text) as Vehicle[];
    expect(parsed.map((v) => v.class_name)).toEqual(
      [a.class_name, b.class_name].sort((x, y) =>
        JSON.stringify(x).localeCompare(JSON.stringify(y)),
      ),
    );
    expect(utf8Bytes(text)).toBe(Buffer.byteLength(text));
  });

  it("writes a manifest that lists every entity file with its count", () => {
    const built = buildPack({
      rows: pack.rows,
      createdAt: pack.manifest.created_at,
      extras: new Map(),
    });
    const manifest: Manifest = built.manifest;
    expect(manifest.files.map((f) => f.entity)).toEqual([...PACK_ENTITIES]);
    for (const file of manifest.files) {
      expect(file.count).toBe(pack.rows[file.entity].length);
    }
  });

  it("trims samples by rule: one port per type, English only, mapper keys kept", () => {
    const trimmed = trimVehicleSample({
      class_name: "X",
      manufacturer: { code: "A", name: "A" },
      size: { en_EN: "Small", de_DE: "Klein" },
      shops: [1, 2, 3],
      ports: [
        { name: "a", type: "Shield" },
        { name: "b", type: "Shield" },
        { name: "c", type: "Cooler", ports: [{ name: "d", type: "Cooler" }] },
      ],
    });
    expect(trimmed["shops"]).toBeUndefined();
    expect(trimmed["manufacturer"]).toEqual({ code: "A", name: "A" });
    expect(trimmed["size"]).toBe("Small");
    expect((trimmed["ports"] as unknown[]).length).toBe(2);
    const item = trimItemSample({
      name: "I",
      shops: [],
      images: [],
      manufacturer: { code: "A" },
    });
    expect(item).toEqual({ name: "I", manufacturer: { code: "A" } });
  });
});
