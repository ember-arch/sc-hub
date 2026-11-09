import { readFileSync } from "node:fs";
import type { Vehicle } from "schema";
import { describe, expect, it } from "vitest";
import { linkEditions } from "../bootstrap-fixtures/editions.js";

const vehicles = JSON.parse(
  readFileSync(
    new URL("../../fixtures/bootstrap/Vehicle.json", import.meta.url),
    "utf8",
  ),
) as Vehicle[];
const template = vehicles[0]!;

/** A vehicle row from the committed template with its identity changed. */
const row = (
  class_name: string,
  name: string,
  manufacturer_code = "RSI",
): Vehicle => ({
  ...template,
  class_name,
  slug: class_name.toLowerCase().replaceAll("_", "-"),
  name,
  manufacturer_code,
  base_variant_of: null,
});

describe("linkEditions", () => {
  it("points a same-name edition at the longest class name it extends", () => {
    const linked = linkEditions([
      row("RSI_Polaris", "Polaris"),
      row("RSI_Polaris_Collector_Military", "Polaris"),
      row("RSI_Constellation_Andromeda", "Constellation Mk IV Andromeda"),
      row("RSI_Constellation_Andromeda_GS", "Constellation Mk IV Andromeda"),
      row(
        "RSI_Constellation_Andromeda_GS_Display",
        "Constellation Mk IV Andromeda",
      ),
    ]);
    const base = Object.fromEntries(
      linked.vehicles.map((v) => [v.class_name, v.base_variant_of]),
    );
    expect(base).toEqual({
      RSI_Polaris: null,
      RSI_Polaris_Collector_Military: "RSI_Polaris",
      RSI_Constellation_Andromeda: null,
      RSI_Constellation_Andromeda_GS: "RSI_Constellation_Andromeda",
      RSI_Constellation_Andromeda_GS_Display: "RSI_Constellation_Andromeda_GS",
    });
    expect(linked.editions).toHaveLength(3);
    expect(linked.unlinked).toEqual([]);
  });

  it("leaves a variant with a name of its own, and another maker's ship, alone", () => {
    const linked = linkEditions([
      row("AEGS_Gladius", "Gladius", "AEGS"),
      row("AEGS_Gladius_Valiant", "Gladius Valiant", "AEGS"),
      row("ANVL_Gladius", "Gladius", "ANVL"),
    ]);
    expect(linked.vehicles.every((v) => v.base_variant_of === null)).toBe(true);
    expect(linked.editions).toEqual([]);
    expect(linked.unlinked).toEqual([]);
  });

  it("reports, and does not guess, same-name vehicles that extend no other", () => {
    const linked = linkEditions([
      row("KRIG_Stingray_A", "S-65 Stingray", "KRIG"),
      row("KRIG_Stingray_B", "S-65 Stingray", "KRIG"),
    ]);
    expect(linked.vehicles.every((v) => v.base_variant_of === null)).toBe(true);
    expect(linked.unlinked).toEqual(["KRIG_Stingray_A", "KRIG_Stingray_B"]);
  });

  it("changes nothing else on the rows", () => {
    const input = [
      row("RSI_Polaris", "Polaris"),
      row("RSI_Polaris_Display", "Polaris"),
    ];
    const linked = linkEditions(input);
    expect(linked.vehicles[1]).toEqual({
      ...input[1]!,
      base_variant_of: "RSI_Polaris",
    });
  });
});
