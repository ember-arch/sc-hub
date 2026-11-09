import { describe, expect, it } from "vitest";
import {
  CONTENTS,
  formatFrontDate,
  pickPlates,
  romanNumeral,
  signed,
} from "../lib/front";

// ADR-020, spec 06: the front page's contents, date line, plate numerals and plate choice.

describe("contents", () => {
  it("lists every section once, numbered in reading order", () => {
    expect(CONTENTS.map((c) => c.number)).toEqual([
      "01",
      "02",
      "03",
      "04",
      "05",
      "06",
    ]);
    expect(new Set(CONTENTS.map((c) => c.href)).size).toBe(CONTENTS.length);
    expect(CONTENTS.map((c) => c.href)).toEqual([
      "/ships",
      "/components",
      "/titles",
      "/funding",
      "/news",
      "/about",
    ]);
  });
});

describe("formatFrontDate", () => {
  it("prints the weekday, day, month and year without a comma, in UTC", () => {
    expect(formatFrontDate(new Date("2026-11-09T23:30:00Z"))).toBe(
      "Monday 9 November 2026",
    );
    expect(formatFrontDate(new Date("2026-01-01T00:00:00Z"))).toBe(
      "Thursday 1 January 2026",
    );
  });
});

describe("romanNumeral", () => {
  it("numbers the plates", () => {
    expect([1, 2, 3, 4, 5, 9, 12, 39].map(romanNumeral)).toEqual([
      "I",
      "II",
      "III",
      "IV",
      "V",
      "IX",
      "XII",
      "XXXIX",
    ]);
  });
  it("refuses what it cannot print", () => {
    expect(() => romanNumeral(0)).toThrow(RangeError);
    expect(() => romanNumeral(40)).toThrow(RangeError);
    expect(() => romanNumeral(1.5)).toThrow(RangeError);
  });
});

describe("pickPlates", () => {
  const ships = [
    { slug: "gladius", length: 20.5, hasPicture: true },
    { slug: "perseus", length: 100, hasPicture: true },
    { slug: "polaris", length: 155, hasPicture: true },
    { slug: "odin", length: 752, hasPicture: false },
    { slug: "carrack", length: 126.5, hasPicture: false },
  ];
  it("puts the live example first, the concept hero second, then the longest other ship with a picture", () => {
    expect(pickPlates(ships, "perseus", "odin").map((s) => s.slug)).toEqual([
      "perseus",
      "odin",
      "polaris",
    ]);
  });
  it("falls back to the longest ship when none of the rest has a picture", () => {
    const bare = ships.map((s) => ({ ...s, hasPicture: false }));
    expect(pickPlates(bare, "perseus", "odin").map((s) => s.slug)).toEqual([
      "perseus",
      "odin",
      "polaris",
    ]);
    const unknown = bare.map((s) => ({ ...s, length: null }));
    expect(pickPlates(unknown, "perseus", "odin")).toHaveLength(3);
  });
  it("takes more of the longest pictured ships when asked", () => {
    expect(pickPlates(ships, "perseus", "odin", 3).map((s) => s.slug)).toEqual([
      "perseus",
      "odin",
      "polaris",
      "gladius",
    ]);
  });
  it("leaves a missing showcase ship's plate out instead of promoting another", () => {
    expect(pickPlates(ships, "perseus", "nova").map((s) => s.slug)).toEqual([
      "perseus",
      "polaris",
    ]);
    expect(pickPlates([], "perseus", "odin")).toEqual([]);
  });
});

describe("signed", () => {
  const plain = (n: number): string => String(n);
  it("signs a change with a plus or a minus sign, never for zero", () => {
    expect(signed(21, plain)).toBe("+21");
    expect(signed(-3, plain)).toBe("−3");
    expect(signed(0, plain)).toBe("0");
  });
});
