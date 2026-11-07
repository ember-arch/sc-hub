import { describe, expect, it } from "vitest";
import {
  MAX_COMPARE,
  compareHref,
  parseCompare,
  toggleShip,
  withShip,
  withoutShip,
} from "../lib/compare";

// Spec 02, criterion "Compare": `/compare?ships=a,b,c,d`, up to four ships, shareable by URL.

describe("parseCompare", () => {
  it("splits, trims, lower-cases and dedupes the ships parameter", () => {
    expect(parseCompare(" Gladius, polaris ,gladius,,carrack")).toEqual({
      slugs: ["gladius", "polaris", "carrack"],
      dropped: [],
    });
  });

  it("caps at four and reports the rest", () => {
    expect(parseCompare("a,b,c,d,e,f")).toEqual({
      slugs: ["a", "b", "c", "d"],
      dropped: ["e", "f"],
    });
    expect(MAX_COMPARE).toBe(4);
  });

  it("takes the first value of a repeated parameter and tolerates none", () => {
    expect(parseCompare(["a,b", "c"]).slugs).toEqual(["a", "b"]);
    expect(parseCompare(undefined)).toEqual({ slugs: [], dropped: [] });
  });
});

describe("compareHref", () => {
  it("round-trips through parseCompare and omits the parameter when empty", () => {
    expect(compareHref([])).toBe("/compare");
    const href = compareHref(["gladius", "cutlass-black"]);
    expect(href).toBe("/compare?ships=gladius,cutlass-black");
    const url = new URL(href, "http://localhost");
    expect(parseCompare(url.searchParams.get("ships") ?? undefined).slugs).toEqual([
      "gladius",
      "cutlass-black",
    ]);
  });
});

describe("withShip, withoutShip, toggleShip", () => {
  it("adds once, removes, and refuses a fifth ship", () => {
    expect(withShip(["a"], "b")).toEqual(["a", "b"]);
    expect(withShip(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(withShip(["a", "b", "c", "d"], "e")).toEqual(["a", "b", "c", "d"]);
    expect(withoutShip(["a", "b"], "a")).toEqual(["b"]);
    expect(withoutShip(["a"], "z")).toEqual(["a"]);
    expect(toggleShip(["a"], "a")).toEqual([]);
    expect(toggleShip(["a"], "b")).toEqual(["a", "b"]);
  });
});
