import { describe, expect, it } from "vitest";
import { pledgePages } from "../bootstrap-fixtures/acquisition.js";
import { conceptSlugs } from "../bootstrap-fixtures/concepts.js";

// ADR-059: 4.10.3 brought the Galaxy (with two module placeholders of the same name) and the
// Liberator into the build. Their concept pages had published /ships/galaxy and /ships/liberator,
// and their prices came from RSI's pledge pages.

const galaxy = { slug: "galaxy", name: "Galaxy", manufacturer_code: "RSI" };
const liberator = {
  slug: "liberator",
  name: "Liberator",
  manufacturer_code: "ANVL",
};
const vehicles = [
  {
    class_name: "RSI_Galaxy_TEMP_Cargo",
    name: "Galaxy",
    manufacturer_code: "RSI",
  },
  { class_name: "RSI_Galaxy", name: "Galaxy", manufacturer_code: "RSI" },
  {
    class_name: "RSI_Galaxy_TEMP_Medical",
    name: "Galaxy",
    manufacturer_code: "RSI",
  },
  {
    class_name: "ANVL_Liberator",
    name: "Liberator",
    manufacturer_code: "ANVL",
  },
  { class_name: "RSI_Aurora_MR", name: "Aurora MR", manufacturer_code: "RSI" },
];

describe("conceptSlugs", () => {
  it("gives a joining concept's slug to its base ship, the shortest class name", () => {
    expect(conceptSlugs([galaxy, liberator], vehicles, new Map())).toEqual(
      new Map([
        ["RSI_Galaxy", "galaxy"],
        ["ANVL_Liberator", "liberator"],
      ]),
    );
  });

  it("never moves a published slug or takes one another class holds", () => {
    // RSI_Galaxy already has a slug of its own: it keeps it.
    expect(
      conceptSlugs([galaxy], vehicles, new Map([["RSI_Galaxy", "rsi-galaxy"]])),
    ).toEqual(new Map());
    // Another class holds "galaxy": the concept's slug stays with it.
    expect(
      conceptSlugs([galaxy], vehicles, new Map([["RSI_Other", "galaxy"]])),
    ).toEqual(new Map());
    // Another maker's ship of the same name is not the concept.
    expect(
      conceptSlugs(
        [{ ...galaxy, manufacturer_code: "ANVL" }],
        vehicles,
        new Map(),
      ),
    ).toEqual(new Map());
  });
});

describe("pledgePages", () => {
  const page = (slug: string) =>
    `https://robertsspaceindustries.com/pledge/ships/${slug}/${slug}`;

  it("reads a pack ship's pledge page and the concepts the pack does not hold, each once", () => {
    const pages = pledgePages(
      [
        { slug: "galaxy", name: "Galaxy", page_url: page("galaxy") },
        { slug: "odin", name: "Odin", page_url: page("odin") },
      ],
      [
        {
          slug: "galaxy",
          class_name: "RSI_Galaxy",
          name: "Galaxy",
          page_url: page("galaxy"),
        },
        {
          slug: "liberator",
          class_name: "ANVL_Liberator",
          name: "Liberator",
          page_url: page("liberator"),
        },
      ],
    );
    expect(pages.map((p) => [p.slug, p.class_name])).toEqual([
      ["galaxy", "RSI_Galaxy"],
      ["liberator", "ANVL_Liberator"],
      ["odin", null],
    ]);
  });
});
