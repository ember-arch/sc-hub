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
    expect(jump.find((c) => c.mark === "N")?.note).toMatch(/Safe to Land/);
    expect(noteFor({ "S/N": "Not / Safe" }, "N")).toBe("Not / Safe");
    expect(noteFor({ "*": "wheels" }, "*")).toBe("wheels");
    expect(noteFor({ "*": "wheels" }, "SRC")).toBeNull();
    expect(noteFor({}, null)).toBeNull();
  });

  it("reads a letter the legend uses twice by the ship it is on", () => {
    // Since 12 Nov 2026 the sheet's "S" is both the 890 Jump's "S/N" and an entry of its own.
    const legend = { "S/N": "Not / Safe to Land", S: "needs vehicle support" };
    expect(noteFor(legend, "S", new Set(["S", "N"]))).toBe(
      "Not / Safe to Land",
    );
    expect(noteFor(legend, "S", new Set(["S"]))).toBe("needs vehicle support");
    expect(noteFor(legend, "S")).toBe("needs vehicle support");
    expect(noteFor(legend, "N", new Set(["N"]))).toBe("Not / Safe to Land");
    expect(noteFor({ "S/N": "pair" }, "S/N")).toBe("pair");
  });

  it("gives the Galaxy's 'S' the legend's own words for it", () => {
    const own = list.legend.marks.S;
    expect(own).toMatch(/vehicle support/);
    const ballista = list.vehicles.find((v) => v.label === "Ballista")!;
    const galaxy = index
      .carriedBy(ballista.class_names[0]!)
      .find((c) => c.carrier.label === "Galaxy");
    expect([galaxy?.mark, galaxy?.note]).toEqual(["S", own]);
  });

  it("counts a ship's marks across its columns, the 890 Jump's hangar and cargo", () => {
    const base = list.carriers[0]!;
    const car = (id: number) => ({
      ...list.vehicles[0]!,
      id,
      class_names: [`TEST_Car${id}`],
    });
    const sheet = ShipFitList.parse({
      ...list,
      carriers: [
        { ...base, id: 0, label: "Jump", slot: "hangar", class_names: ["J"] },
        { ...base, id: 1, label: "Jump", slot: "cargo", class_names: ["J"] },
        { ...base, id: 2, label: "Lifter", slot: null, class_names: ["L"] },
      ],
      vehicles: [car(0), car(1), car(2)],
      legend: {
        verdicts: list.legend.verdicts,
        marks: { "S/N": "Not / Safe", S: "needs a lift" },
      },
      fits: [
        { carrier: 0, vehicle: 0, verdict: "fits", mark: "N" },
        { carrier: 1, vehicle: 1, verdict: "fits", mark: "S" },
        { carrier: 2, vehicle: 2, verdict: "fits", mark: "S" },
      ],
    });
    const built = buildFittingIndex(sheet);
    expect(built.carries("J").map((c) => c.note)).toEqual([
      "Not / Safe",
      "Not / Safe",
    ]);
    expect(built.carries("L")[0]!.note).toBe("needs a lift");
  });

  it("drops words that open with another verdict's words, and keeps them under their own", () => {
    const sheet = ShipFitList.parse({
      ...list,
      carriers: [
        { ...list.carriers[0]!, id: 0, class_names: ["TEST_Carrier"] },
      ],
      vehicles: [{ ...list.vehicles[0]!, id: 0, class_names: ["TEST_Car"] }],
      legend: {
        verdicts: list.legend.verdicts,
        marks: { "S/N": "Not / Safe", S: "Good Fit, but needs a lift" },
      },
      fits: [{ carrier: 0, vehicle: 0, verdict: "no", mark: "S" }],
    });
    const red = buildFittingIndex(sheet).carries("TEST_Carrier")[0]!;
    expect([red.mark, red.note]).toEqual(["S", null]);
    const green = buildFittingIndex({
      ...sheet,
      fits: [{ carrier: 0, vehicle: 0, verdict: "fits", mark: "S" }],
    }).carries("TEST_Carrier")[0]!;
    expect(green.note).toBe("Good Fit, but needs a lift");
  });
});
