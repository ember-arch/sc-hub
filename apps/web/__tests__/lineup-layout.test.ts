import { describe, expect, it } from "vitest";
import {
  PERSON_WIDTH,
  layoutRow,
  rowGap,
  spectrumAround,
} from "../app/ships/[slug]/showcase/lineup-layout";

const ships = [
  { slug: "gladius", length: 21 },
  { slug: "odin", length: 752 },
  { slug: "fury", length: 7 },
];

describe("layoutRow", () => {
  it("stands the ships largest first, each as long as its record", () => {
    const row = layoutRow(ships, false);
    expect(row.slots.map((s) => s.ship.slug)).toEqual([
      "odin",
      "gladius",
      "fury",
    ]);
    for (const s of row.slots) expect(s.length).toBe(s.ship.length);
    for (const s of row.slots) expect(s.x).toBeCloseTo(s.from + s.length / 2);
  });

  it("keeps a gap after each ship that follows the smaller neighbour, two metres at least", () => {
    const row = layoutRow(ships, false);
    const [odin, gladius, fury] = row.slots;
    expect(gladius!.from - (odin!.from + odin!.length)).toBeCloseTo(
      rowGap(752, 21),
    );
    expect(fury!.from - (gladius!.from + gladius!.length)).toBeCloseTo(
      rowGap(21, 7),
    );
    expect(rowGap(752, 21)).toBeCloseTo(0.22 * 21);
    expect(rowGap(7, 7)).toBe(2);
    expect(rowGap(3, undefined)).toBe(2);
  });

  it("centres the row on the origin", () => {
    const row = layoutRow(ships, false);
    const first = row.slots[0]!;
    const last = row.slots[row.slots.length - 1]!;
    expect(first.from).toBeCloseTo(-row.rowLength / 2);
    expect(last.from + last.length).toBeCloseTo(row.rowLength / 2);
    expect(row.personAt).toBeNull();
  });

  it("leaves room for the person after the smallest ship", () => {
    const row = layoutRow(ships, true);
    const last = row.slots[row.slots.length - 1]!;
    expect(row.personAt).toBeCloseTo(last.from + last.length + rowGap(7, 7));
    expect(row.personAt! + PERSON_WIDTH).toBeCloseTo(row.rowLength / 2);
  });

  it("lays out an empty row", () => {
    const row = layoutRow([], false);
    expect(row.slots).toEqual([]);
    expect(row.rowLength).toBe(0);
  });
});

describe("spectrumAround", () => {
  const catalog = [
    { slug: "merlin", length: 12 },
    { slug: "gladius", length: 21 },
    { slug: "cutlass", length: 38 },
    { slug: "freelancer", length: 45 },
    { slug: "constellation", length: 61 },
    { slug: "hercules", length: 94 },
    { slug: "hammerhead", length: 111 },
    { slug: "carrack", length: 123 },
    { slug: "polaris", length: 155 },
    { slug: "idris", length: 240 },
    { slug: "javelin", length: 480 },
    { slug: "odin", length: 752 },
  ];
  const by = (slug: string) => catalog.find((s) => s.slug === slug)!;

  it("reaches for a quarter, half, twice and four times the page ship's length, largest first", () => {
    // 94 m: 23.5 → the Gladius, 47 → the Freelancer, 188 → the Polaris, 376 → the Javelin.
    expect(spectrumAround(catalog, by("hercules")).map((s) => s.slug)).toEqual([
      "javelin",
      "polaris",
      "freelancer",
      "gladius",
    ]);
  });

  it("stands the nearest ships left in where the catalog runs out on one side", () => {
    // The largest: nothing twice or four times its size, so the next ships down stand in.
    expect(spectrumAround(catalog, by("odin")).map((s) => s.slug)).toEqual([
      "javelin",
      "idris",
      "polaris",
      "carrack",
    ]);
    // The smallest: nothing a quarter or half its size, so the next ships up stand in.
    expect(spectrumAround(catalog, by("merlin")).map((s) => s.slug)).toEqual([
      "constellation",
      "freelancer",
      "cutlass",
      "gladius",
    ]);
  });

  it("never picks the page's ship, and gives every other ship when fewer than four are on record", () => {
    const few = catalog.slice(0, 3);
    expect(spectrumAround(few, few[1]!).map((s) => s.slug)).toEqual([
      "cutlass",
      "merlin",
    ]);
    for (const ship of catalog) {
      const picks = spectrumAround(catalog, ship);
      expect(picks).toHaveLength(4);
      expect(new Set(picks.map((s) => s.slug)).size).toBe(4);
      expect(picks.some((s) => s.slug === ship.slug)).toBe(false);
    }
  });
});
