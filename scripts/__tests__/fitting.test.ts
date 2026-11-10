import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  type Aliases,
  type PackName,
  parseFittingSheet,
  resolveLabel,
  splitLabel,
  toFixture,
  verdictOfWords,
} from "../fitting/fetch.js";
import { type Sheet, readWorkbook, serialToIsoDate } from "../fitting/xlsx.js";

// ADR-028: the fitting list is copied from the sheet's own cells and legend; a heading or a
// legend the script does not recognise halts it. No test reaches the network.

const root = join(import.meta.dirname, "..", "..");
const sample = JSON.parse(
  readFileSync(
    join(root, "fixtures", "fitting", "samples", "sheet-cells.sample.json"),
    "utf8",
  ),
) as Sheet;
const pack = (
  JSON.parse(
    readFileSync(join(root, "fixtures", "bootstrap", "Vehicle.json"), "utf8"),
  ) as PackName[]
).map((v) => ({ name: v.name, class_name: v.class_name }));
const aliases = JSON.parse(
  readFileSync(join(root, "scripts", "fitting", "names.json"), "utf8"),
) as Record<string, unknown>;
delete aliases["_"];
const names = aliases as Aliases;

describe("the words and names", () => {
  it("reads a verdict from the legend's words", () => {
    expect(verdictOfWords("Good Fit")).toBe("fits");
    expect(verdictOfWords("Doesn't fit")).toBe("no");
    expect(verdictOfWords("Needs tricks / barely fit")).toBe("tricks");
    expect(verdictOfWords("No info / not tested")).toBe("untested");
    expect(verdictOfWords("Fits but bugged")).toBe("bugged");
    expect(verdictOfWords("Cargo / Garage")).toBeNull();
  });

  it("splits a label into the names to look for", () => {
    expect(splitLabel("Avenger (ALL)")).toEqual({
      parts: ["Avenger"],
      all: true,
    });
    expect(splitLabel("Cutlass / Variants")).toEqual({
      parts: ["Cutlass"],
      all: true,
    });
    expect(splitLabel("Terrapin/Medic")).toEqual({
      parts: ["Terrapin", "Medic"],
      all: false,
    });
    expect(splitLabel("MOTH [X]")).toEqual({ parts: ["MOTH"], all: false });
  });

  it("finds pack ships by exact name, by variants, by the MISC prefix and by names.json", () => {
    expect(resolveLabel("Carrack", pack, names).sort()).toEqual([
      "ANVL_Carrack",
      "ANVL_Carrack_BIS2950",
    ]);
    expect(resolveLabel("Avenger (ALL)", pack, names)).toContain(
      "AEGS_Avenger_Warlock",
    );
    expect(resolveLabel("Starlite", pack, names)).toEqual(["MISC_Starlite"]);
    expect(resolveLabel("Starlancer TAC/MAX", pack, names).sort()).toEqual([
      "MISC_Starlancer_Max",
      "MISC_Starlancer_TAC",
    ]);
    expect(resolveLabel("Galaxy", pack, names)).toEqual([]);
    expect(resolveLabel("Nothing of the kind", pack, names)).toEqual([]);
    expect(() =>
      resolveLabel("Wrong", pack, { Wrong: ["No such ship"] }),
    ).toThrow(/not in the pack/);
  });
});

describe("parseFittingSheet", () => {
  const parsed = parseFittingSheet(sample, pack, names);

  it("reads the build, the date and the legend from the sheet's own cells", () => {
    expect(parsed.build_label).toBe("PRE LIVE 4.10.3");
    expect(parsed.last_update).toBe("2026-11-09");
    expect(parsed.legend.verdicts).toMatchObject({
      fits: "Good Fit",
      no: "Doesn't fit",
      tricks: "Needs tricks / barely fit",
      untested: "No info / not tested",
      bugged: "Fits but bugged",
    });
    expect(parsed.legend.marks["UD"]).toBe("Literally park Upside Down");
    expect(parsed.legend.marks["E"]).toMatch(/barely fit/i);
  });

  it("reads a carrier's spaces from the markers: the Carrack's H and C, the Starlancer's H before its name", () => {
    const carrack = parsed.carriers.filter((c) => c.label === "Carrack");
    expect(carrack.map((c) => [c.column, c.slot])).toEqual([
      [9, "hangar"],
      [10, "cargo"],
    ]);
    const starlancer = parsed.carriers.filter((c) =>
      c.label.startsWith("Starlancer"),
    );
    expect(starlancer.map((c) => [c.column, c.slot])).toEqual([
      [40, "hangar"],
      [41, "cargo"],
    ]);
    const max = parsed.carriers.filter((c) => c.label === "Freelancer MAX");
    expect(max.map((c) => c.column)).toEqual([39]);
    const tyilui = parsed.carriers.find((c) => c.label === "GATAC Tyilui")!;
    expect(tyilui).toMatchObject({ slot: null, marker: "x" });
    const javelin = parsed.carriers.find((c) => c.label === "JAVELIN")!;
    expect(javelin).toMatchObject({
      unreleased: true,
      class_names: ["AEGS_Javelin"],
    });
    expect(
      parsed.carriers.find((c) => c.label === "890 Jump")!.unreleased,
    ).toBe(false);
  });

  it("reads the vehicles by section and each cell's verdict from its colour", () => {
    expect(parsed.vehicles.map((v) => v.label)).toEqual([
      "Avenger (ALL)",
      "Eclipse",
      "Gladius",
      "Sabre / Variants",
      "Vanguard / Variants",
      "Ballista",
      "Centurion",
    ]);
    expect(parsed.vehicles[0]).toMatchObject({
      maker_label: "Aegis",
      group: "ship",
    });
    expect(parsed.vehicles[5]).toMatchObject({
      maker_label: "Anvil",
      group: "ground",
    });
    const idris = parsed.carriers.find((c) => c.label === "IDRIS")!;
    const avenger = parsed.vehicles[0]!;
    const inIdris = parsed.fits.find(
      (f) => f.carrier === idris.id && f.vehicle === avenger.id,
    );
    expect(inIdris).toMatchObject({ verdict: "fits", mark: null });
    const titan = parsed.carriers.find((c) => c.label === "Titan R./A.")!;
    expect(
      parsed.fits.find(
        (f) => f.carrier === titan.id && f.vehicle === avenger.id,
      ),
    ).toMatchObject({ verdict: "no" });
    const jump = parsed.carriers.find(
      (c) => c.label === "890 Jump" && c.slot === "hangar",
    )!;
    expect(
      parsed.fits.find(
        (f) => f.carrier === jump.id && f.vehicle === avenger.id,
      ),
    ).toMatchObject({ verdict: "fits", mark: "S" });
    // The Liberator's column is purple all the way down: not tested.
    const liberator = parsed.carriers.find((c) => c.label === "Liberator")!;
    expect(
      parsed.fits.find(
        (f) => f.carrier === liberator.id && f.vehicle === avenger.id,
      ),
    ).toMatchObject({ verdict: "untested" });
    expect(parsed.unmatched).toEqual([]);
  });

  it("reads the fabricator row and stops at the rumours", () => {
    expect(
      parsed.carriers.find((c) => c.label === "Hammerhead")!.fabricator,
    ).toBe("fits");
    expect(
      parsed.carriers.find((c) => c.label === "Titan R./A.")!.fabricator,
    ).toBe("no");
    expect(parsed.vehicles.some((v) => v.label === "Auxilia")).toBe(false);
  });

  it("gives a fixture the schema accepts", () => {
    const fixture = toFixture(parsed, "2026-11-10T12:00:00.000Z", "pending");
    expect(fixture.source.author).toBe("u/Pegaxsus");
    expect(fixture.fits.length).toBeGreaterThan(50);
  });

  it("halts on a sheet without the heading or the legend", () => {
    const blank: Sheet = { name: "x", cells: [[{ v: "nothing", fill: null }]] };
    expect(() => parseFittingSheet(blank, pack, names)).toThrow(/heading row/);
    const noLegend: Sheet = {
      name: "x",
      cells: [
        [],
        [],
        [
          { v: "LIVE 1.0", fill: null },
          undefined,
          { v: "Carrack", fill: null },
        ],
      ],
    };
    expect(() => parseFittingSheet(noLegend, pack, names)).toThrow(/legend/);
  });
});

describe("readWorkbook", () => {
  it("reads cells, shared strings and solid fills from a small workbook", () => {
    const files = {
      "[Content_Types].xml": strToU8("<Types/>"),
      "_rels/.rels": strToU8("<Relationships/>"),
      "xl/workbook.xml": strToU8(
        '<workbook xmlns:r="r"><sheets><sheet name="COMBINED SHEET" sheetId="1" r:id="rId1"/></sheets></workbook>',
      ),
      "xl/_rels/workbook.xml.rels": strToU8(
        '<Relationships><Relationship Id="rId1" Type="t" Target="worksheets/sheet1.xml"/></Relationships>',
      ),
      "xl/sharedStrings.xml": strToU8(
        "<sst><si><t>Carrack</t></si><si><r><t>Good</t></r><r><t> Fit</t></r></si></sst>",
      ),
      "xl/styles.xml": strToU8(
        '<styleSheet><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF93C47D"/></patternFill></fill></fills><cellXfs count="2"><xf fillId="0"/><xf fillId="1"/></cellXfs></styleSheet>',
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" s="1" t="s"><v>1</v></c></row><row r="3"><c r="B3" s="1"/><c r="AA3"><v>46335</v></c></row></sheetData></worksheet>',
      ),
    };
    const sheets = readWorkbook(zipSync(files));
    expect(sheets).toHaveLength(1);
    const cells = sheets[0]!.cells;
    expect(sheets[0]!.name).toBe("COMBINED SHEET");
    expect(cells[0]?.[0]).toEqual({ v: "Carrack", fill: null });
    expect(cells[0]?.[2]).toEqual({ v: "Good Fit", fill: "93C47D" });
    expect(cells[2]?.[1]).toEqual({ v: "", fill: "93C47D" });
    expect(cells[2]?.[26]).toEqual({ v: "46335", fill: null });
    expect(serialToIsoDate(46335)).toBe("2026-11-09");
  });
});
