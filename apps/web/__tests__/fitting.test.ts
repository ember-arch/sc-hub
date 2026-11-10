import { readFileSync } from "node:fs";
import { ShipFitList } from "schema";
import { describe, expect, it } from "vitest";
import { buildFittingIndex, noteFor } from "../lib/fitting";

// ADR-028: the fitting list is community-tested data, indexed by the pack's class names.

const list = ShipFitList.parse(
  JSON.parse(
    readFileSync(
      new URL("../../../fixtures/fitting/ShipFit.json", import.meta.url),
      "utf8",
    ),
  ),
);
const index = buildFittingIndex(list);

describe("buildFittingIndex", () => {
  it("lists what the Carrack carries, by its hangar and its cargo bay, fits first", () => {
    const carries = index.carries("ANVL_Carrack");
    expect(carries.length).toBeGreaterThan(100);
    const pisces = carries.filter((c) => c.vehicle.label === "C8 PIsces");
    expect(pisces.map((c) => [c.slot, c.verdict])).toEqual([
      ["hangar", "fits"],
      ["cargo", "tricks"],
    ]);
    expect(carries[0]!.verdict).toBe("fits");
    expect(carries.at(-1)!.verdict).toBe("untested");
    expect(index.fabricator("ANVL_Carrack")).toBe("fits");
    expect(index.knows("ANVL_Carrack")).toBe(true);
  });

  it("lists what carries the Cyclone, and nothing for a ship the sheet does not name", () => {
    const carriedBy = index.carriedBy("TMBL_Cyclone");
    expect(
      carriedBy.some(
        (c) => c.carrier.label === "Carrack" && c.verdict === "fits",
      ),
    ).toBe(true);
    expect(
      carriedBy.every(
        (c) =>
          c.carrier.class_names.length > 0 ||
          c.carrier.unreleased ||
          c.carrier.label === "Liberator" ||
          c.carrier.label === "Galaxy",
      ),
    ).toBe(true);
    expect(index.carriedBy("NOPE_Nothing")).toEqual([]);
    expect(index.knows("NOPE_Nothing")).toBe(false);
  });

  it("keeps the mark and finds the legend's words for it, 'S' under 'S/N' included", () => {
    const jump = index.carries("ORIG_890Jump");
    const marked = jump.find((c) => c.mark === "S");
    expect(marked?.note).toMatch(/Safe to Land/);
    expect(noteFor({ "S/N": "Not / Safe" }, "N")).toBe("Not / Safe");
    expect(noteFor({ "*": "wheels" }, "*")).toBe("wheels");
    expect(noteFor({ "*": "wheels" }, "SRC")).toBeNull();
    expect(noteFor({}, null)).toBeNull();
  });
});
