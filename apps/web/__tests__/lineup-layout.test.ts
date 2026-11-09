import { describe, expect, it } from "vitest";
import {
  PERSON_WIDTH,
  layoutRow,
  rowGap,
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
