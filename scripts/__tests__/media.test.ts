import { describe, expect, it } from "vitest";
import {
  FANKIT_LOGOS,
  type MatrixShip,
  RSI_IMAGE_SIZE,
  createSpacer,
  logoRenditionPath,
  matchShips,
  shipRenditionPath,
} from "../media/sources.js";

// ADR-009: a ship gets RSI's image only on an exact name and maker match. No network here.

const row = (
  name: string,
  code: string,
  image:
    | string
    | null = `https://media.robertsspaceindustries.com/x/${RSI_IMAGE_SIZE}.jpg`,
): MatrixShip => ({
  name,
  url: `/pledge/ships/${name.toLowerCase()}/${name}`,
  manufacturer: { code },
  media: image === null ? [] : [{ images: { [RSI_IMAGE_SIZE]: image } }],
});

const gladius = {
  class_name: "AEGS_Gladius",
  name: "Gladius",
  manufacturer_code: "AEGS",
};

describe("matchShips", () => {
  it("matches on identical name and maker code and builds the absolute page URL", () => {
    const { matched, unmatched } = matchShips(
      [gladius],
      [row("Gladius", "AEGS")],
    );
    expect(unmatched).toEqual([]);
    expect(matched).toEqual([
      {
        vehicle: gladius,
        pageUrl:
          "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
        imageUrl: `https://media.robertsspaceindustries.com/x/${RSI_IMAGE_SIZE}.jpg`,
      },
    ]);
  });

  it("ignores the stray trailing space the matrix writes after a few names", () => {
    const ballista = {
      class_name: "ANVL_Ballista",
      name: "Ballista",
      manufacturer_code: "ANVL",
    };
    const { matched, unmatched } = matchShips(
      [ballista],
      [row("Ballista ", "ANVL")],
    );
    expect(unmatched).toEqual([]);
    expect(matched).toHaveLength(1);
    // Two rows that differ only by that space are two rows: no match, reported.
    const twins = matchShips(
      [ballista],
      [row("Ballista", "ANVL"), row("Ballista ", "ANVL")],
    );
    expect(twins.matched).toEqual([]);
    expect(twins.unmatched[0]?.reason).toMatch(/2 ship-matrix rows/);
  });

  it("matches on the wiki's record of the ship-matrix name when the display name differs", () => {
    const freelancer = {
      class_name: "MISC_Freelancer",
      name: "MISC Freelancer",
      manufacturer_code: "MISC",
      matrix_name: "Freelancer",
    };
    const { matched, unmatched } = matchShips(
      [freelancer],
      [row("Freelancer", "MISC"), row("MISC Freelancer", "MISC")],
    );
    expect(unmatched).toEqual([]);
    expect(matched[0]?.pageUrl).toBe(
      "https://robertsspaceindustries.com/pledge/ships/freelancer/Freelancer",
    );
    // The record wins even where the display name would also match a row.
    expect(
      matchShips(
        [{ ...gladius, matrix_name: "Gladius Pirate Edition" }],
        [row("Gladius", "AEGS"), row("Gladius Pirate Edition", "AEGS")],
      ).matched[0]?.pageUrl,
    ).toContain("Gladius%20Pirate%20Edition");
  });

  it("falls back to the display name when the record names no row, and treats an empty record as none", () => {
    const renamed = { ...gladius, matrix_name: "Gladius (old name)" };
    expect(
      matchShips([renamed], [row("Gladius", "AEGS")]).matched[0]?.vehicle,
    ).toBe(renamed);
    const empty = { ...gladius, matrix_name: "" };
    expect(
      matchShips([empty], [row("Gladius", "AEGS")]).matched[0]?.vehicle,
    ).toBe(empty);
    expect(
      matchShips([renamed], [row("Gladius Valiant", "AEGS")]).unmatched[0]
        ?.reason,
    ).toMatch(/no ship-matrix row/);
  });

  it("never matches on a near name or another maker", () => {
    const { matched, unmatched } = matchShips(
      [gladius],
      [
        row("Gladius Valiant", "AEGS"),
        row("gladius", "AEGS"),
        row("Gladius", "ANVL"),
      ],
    );
    expect(matched).toEqual([]);
    expect(unmatched[0]?.reason).toMatch(/no ship-matrix row/);
  });

  it("refuses an ambiguous match", () => {
    const { matched, unmatched } = matchShips(
      [gladius],
      [row("Gladius", "AEGS"), row("Gladius", "AEGS")],
    );
    expect(matched).toEqual([]);
    expect(unmatched[0]?.reason).toBe(
      "2 ship-matrix rows share this name and maker",
    );
  });

  it("reports a ship whose row has no image or a non-https one", () => {
    expect(
      matchShips([gladius], [row("Gladius", "AEGS", null)]).unmatched[0]
        ?.reason,
    ).toBe(`no ${RSI_IMAGE_SIZE} image`);
    expect(
      matchShips(
        [gladius],
        [row("Gladius", "AEGS", "http://example.com/a.jpg")],
      ).matched,
    ).toEqual([]);
  });
});

describe("createSpacer", () => {
  it("starts requests at least the spacing apart", async () => {
    let clock = 0;
    const waits: number[] = [];
    const spacer = createSpacer(
      5_000,
      async (ms) => {
        waits.push(ms);
        clock += ms;
      },
      () => clock,
    );
    await spacer();
    clock += 1_200;
    await spacer();
    await spacer();
    expect(waits).toEqual([3_800, 5_000]);
  });
});

describe("rendition paths", () => {
  it("are lower case and under /media/", () => {
    expect(shipRenditionPath("DRAK_Cutlass_Black", 640)).toBe(
      "/media/ships/drak_cutlass_black-640.webp",
    );
    expect(logoRenditionPath("MRAI", "dark")).toBe(
      "/media/makers/mrai-on-dark.webp",
    );
  });
});

describe("FANKIT_LOGOS", () => {
  it("names a dark mark for every maker and only fankit PNGs", () => {
    for (const [code, files] of Object.entries(FANKIT_LOGOS)) {
      expect(code).toMatch(/^[A-Z]{3,4}$/);
      expect(files.onLight).toMatch(/\.png$/);
      if (files.onDark !== null) expect(files.onDark).toMatch(/\.png$/);
    }
  });
});

describe("showcase figures (ADR-014)", () => {
  it("places every image and render loop in a section, a role, or the unused list with a reason", async () => {
    const { SHOWCASE, FILE_SECTIONS } = await import("../media/showcase.js");
    for (const ship of SHOWCASE) {
      const placed = new Set<string>(Object.values(ship.layout.roles));
      for (const section of FILE_SECTIONS) {
        for (const fig of ship.layout.sections[section] ?? []) {
          placed.add(fig.file);
          if (fig.narrow !== undefined) placed.add(fig.narrow);
        }
      }
      const media = ship.files;
      for (const file of media) {
        const reason = ship.layout.unused[file.file];
        expect(
          placed.has(file.file) || (reason !== undefined && reason !== ""),
          `${ship.slug}: ${file.file}`,
        ).toBe(true);
      }
      // Nothing placed or excused that the ship does not have.
      const names = new Set(media.map((f) => f.file));
      for (const name of [...placed, ...Object.keys(ship.layout.unused)]) {
        expect(names.has(name), `${ship.slug}: unknown ${name}`).toBe(true);
      }
    }
  });
});
