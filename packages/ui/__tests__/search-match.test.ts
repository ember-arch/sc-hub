import { describe, expect, it } from "vitest";
import {
  PER_GROUP,
  type SearchEntry,
  matchEntries,
} from "../components/search-match";

const entries: SearchEntry[] = [
  {
    type: "ship",
    name: "Gladius",
    href: "/ships/gladius",
    meta: "Aegis Dynamics",
  },
  {
    type: "ship",
    name: "Carrack",
    href: "/ships/carrack",
    meta: "Anvil Aerospace",
  },
  {
    type: "manufacturer",
    name: "Aegis Dynamics",
    href: "/manufacturers/aegis-dynamics",
  },
  {
    type: "component",
    name: "Mantis GT-220 Gatling",
    href: "/components/mantis",
    meta: "Weapon",
  },
  {
    type: "component",
    name: "Arrester III Missile",
    href: "/components/arrester",
    meta: "Missile",
  },
  ...Array.from({ length: PER_GROUP + 3 }, (_, i) => ({
    type: "component" as const,
    name: `Bracer ${String(i).padStart(2, "0")}`,
    href: `/components/bracer-${i}`,
    meta: "Cooler",
  })),
];

describe("matchEntries", () => {
  it("returns nothing for an empty or blank query", () => {
    expect(matchEntries(entries, "")).toEqual([]);
    expect(matchEntries(entries, "   ")).toEqual([]);
  });

  it("ranks name prefix, then name substring, then meta substring, grouped by type", () => {
    const names = matchEntries(entries, "a").map((e) => e.name);
    // Ships first: Gladius matches only on meta ("Aegis"), Carrack on name; prefix wins over substring.
    expect(names.slice(0, 2)).toEqual(["Carrack", "Gladius"]);
    // Components next, manufacturers last.
    expect(names.at(-1)).toBe("Aegis Dynamics");
  });

  it("is case-insensitive and trims the query", () => {
    expect(matchEntries(entries, "  GLAD ")[0]?.name).toBe("Gladius");
  });

  it("caps each group at PER_GROUP results", () => {
    const coolers = matchEntries(entries, "cooler");
    expect(coolers).toHaveLength(PER_GROUP);
    expect(coolers.every((e) => e.type === "component")).toBe(true);
  });

  it("matches on meta text such as the item type", () => {
    expect(matchEntries(entries, "missile").map((e) => e.name)).toEqual([
      "Arrester III Missile",
    ]);
  });
});
