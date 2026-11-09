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
