/**
 * Copies Pegaxsus's "Star Citizen Ship Fitting List" into `fixtures/fitting/ShipFit.json`
 * (ADR-028): which ships and ground vehicles fit inside which ships, tested in play by its author
 * and kept in a public Google Sheet, patch by patch. Not game data, and shown as such. One
 * request for the workbook, read cell by cell: the carriers across the heading row with their
 * H, C and CM markers, the vehicles down the rows in their ship and ground sections, each cell's
 * verdict from its colour as the sheet's own legend defines it, and the mark written in it. The
 * sheet's names are matched to the pack's by rule and by `names.json`; a name the rules cannot
 * place keeps an empty list and is reported. Halts on a sheet, a legend or a heading it does not
 * recognise, and writes nothing.
 *
 *   pnpm --filter schema build && pnpm exec tsx scripts/fitting/fetch.ts
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type FitCarrier,
  type FitVehicle,
  type FitVerdict,
  type ShipFit,
  ShipFitList,
} from "schema";
import { userAgent } from "../user-agent.js";
import {
  type Cell,
  type Sheet,
  readWorkbook,
  serialToIsoDate,
} from "./xlsx.js";

export const SHEET_ID = "15wiwmRnwqzBDpFF0B02ifxHH3OqNe0CLAtL8NU3hefc";
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
export const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=xlsx`;
export const SHEET_NAME = "COMBINED SHEET";
export const AUTHOR = "u/Pegaxsus";
export const TITLE = "Star Citizen Ship Fitting List";

export interface PackName {
  readonly name: string;
  readonly class_name: string;
}

/** `names.json`: a sheet label to pack names, exact or "Name *" for a prefix. */
export type Aliases = Readonly<Record<string, readonly string[]>>;

const text = (c: Cell | undefined): string =>
  (c?.v ?? "").replace(/\s+/g, " ").trim();
const at = (sheet: Sheet, r: number, c: number): Cell | undefined =>
  sheet.cells[r]?.[c];

/** The verdict a legend entry's words name, or null for an entry that is not a verdict. */
export function verdictOfWords(words: string): FitVerdict | null {
  const w = words.toLowerCase();
  if (/bugged/.test(w)) return "bugged";
  if (/good fit/.test(w)) return "fits";
  if (/doesn'?t fit|does not fit/.test(w)) return "no";
  if (/tricks|barely/.test(w)) return "tricks";
  if (/no info|not tested/.test(w)) return "untested";
  return null;
}

export interface Legend {
  readonly verdictByFill: ReadonlyMap<string, FitVerdict>;
  readonly verdicts: Readonly<Partial<Record<FitVerdict, string>>>;
  readonly marks: Readonly<Record<string, string>>;
}

/**
 * The legend under the "Leyend" cell: pairs of a symbol cell (its colour is the meaning) and a
 * words cell, two pairs a row. Every verdict but "bugged" must be there, or the run halts.
 */
export function readLegend(sheet: Sheet, r0: number, c0: number): Legend {
  const byFill = new Map<string, FitVerdict>();
  const verdicts: Partial<Record<FitVerdict, string>> = {};
  const marks: Record<string, string> = {};
  for (let r = r0 + 1; r < r0 + 30; r += 1) {
    for (const c of [c0, c0 + 7]) {
      const symbol = at(sheet, r, c);
      const words = text(at(sheet, r, c + 1));
      if (words === "") continue;
      const verdict = verdictOfWords(words);
      const fill = symbol?.fill ?? null;
      const mark = text(symbol);
      // A colour entry (no symbol, or the tick or cross) names a verdict; a symbol entry names
      // a mark, whatever its words say, and the first words for a symbol stand.
      if (mark === "" || mark === "✔" || mark === "X") {
        if (verdict !== null && fill !== null) {
          byFill.set(fill, verdict);
          verdicts[verdict] = words;
        }
      } else if (marks[mark] === undefined) {
        marks[mark] = words;
      }
    }
  }
  for (const needed of ["fits", "no", "tricks", "untested"] as const) {
    if (verdicts[needed] === undefined)
      throw new Error(`the legend names no colour for "${needed}"`);
  }
  return { verdictByFill: byFill, verdicts, marks };
}

const SLOTS: Readonly<Record<string, FitCarrier["slot"]>> = {
  H: "hangar",
  C: "cargo",
  "w/CM": "cargo_module",
  CM: "cargo_module",
};

/** "Name (ALL)", "Name / Variants", "Name [X]": the names to look for and whether variants count. */
export function splitLabel(label: string): { parts: string[]; all: boolean } {
  let s = label.replace(/\[[^\]]*\]/g, " ");
  let all = false;
  if (/\(all\)/i.test(s)) {
    all = true;
    s = s.replace(/\(all\)/gi, " ");
  }
  const parts = s
    .split("/")
    .map((p) => p.trim())
    .filter((p) => {
      if (/^variants?$/i.test(p)) {
        all = true;
        return false;
      }
      return p !== "";
    });
  return { parts, all };
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .replace(/^misc\s+/, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The pack vehicles a sheet label names: by `names.json` first, else each part of the label as
 * an exact pack name (the maker prefix "MISC" aside), plus every name that starts with it where
 * the label says all variants count. Unknown returns an empty list.
 */
export function resolveLabel(
  label: string,
  pack: readonly PackName[],
  aliases: Aliases,
): string[] {
  const found = new Set<string>();
  const exact = (name: string): PackName[] =>
    pack.filter((p) => fold(p.name) === fold(name));
  const prefixed = (name: string): PackName[] =>
    pack.filter((p) => fold(p.name).startsWith(`${fold(name)} `));
  const alias = aliases[label];
  if (alias !== undefined) {
    for (const entry of alias) {
      const matches = entry.endsWith(" *")
        ? prefixed(entry.slice(0, -2))
        : exact(entry);
      if (matches.length === 0)
        throw new Error(
          `names.json: "${label}" names "${entry}", which is not in the pack`,
        );
      for (const m of matches) found.add(m.class_name);
    }
    return [...found];
  }
  const { parts, all } = splitLabel(label);
  for (const part of parts) {
    for (const m of exact(part)) found.add(m.class_name);
    if (all) for (const m of prefixed(part)) found.add(m.class_name);
  }
  return [...found];
}

export interface ParsedList {
  readonly build_label: string;
  readonly last_update: string;
  readonly legend: Legend;
  readonly carriers: FitCarrier[];
  readonly vehicles: FitVehicle[];
  readonly fits: ShipFit[];
  readonly unmatched: string[];
  readonly contradictions: number;
}

/** The sheet, read by its own headings. */
export function parseFittingSheet(
  sheet: Sheet,
  pack: readonly PackName[],
  aliases: Aliases,
): ParsedList {
  // The heading row: the one whose first cell names the build ("PRE LIVE 4.10.3").
  const r0 = sheet.cells.findIndex(
    (row) => row !== undefined && /\bLIVE\b/i.test(text(row[0])),
  );
  if (r0 < 0) throw new Error("no heading row naming the build");
  const build_label = text(at(sheet, r0, 0));
  const markers = r0 + 1;

  // The legend and the right edge: the "SHIP FIT LIST" title stands in the legend's column.
  const row0 = sheet.cells[r0] ?? [];
  const legendColumn = row0.findIndex((c) => /SHIP FIT LIST/i.test(text(c)));
  if (legendColumn < 0) throw new Error("no legend column");
  let legendRow = -1;
  for (let r = r0; r < r0 + 10; r += 1) {
    if (/^leyend$|^legend$/i.test(text(at(sheet, r, legendColumn))))
      legendRow = r;
  }
  if (legendRow < 0) throw new Error("no legend");
  const legend = readLegend(sheet, legendRow, legendColumn);

  // "UNRELEASED" above the heading row marks the columns from it on.
  const above = sheet.cells[r0 - 1] ?? [];
  const unreleasedFrom = above.findIndex((c) => /unreleased/i.test(text(c)));

  // "LAST UPDATE:" anywhere in the legend's columns, the date beside it.
  let last_update: string | null = null;
  for (let r = 0; r < sheet.cells.length; r += 1) {
    for (let c = legendColumn; c < legendColumn + 12; c += 1) {
      if (/last update/i.test(text(at(sheet, r, c)))) {
        for (let d = c + 1; d < c + 6; d += 1) {
          const raw = text(at(sheet, r, d));
          if (raw === "") continue;
          last_update = /^\d+(\.\d+)?$/.test(raw)
            ? serialToIsoDate(Number(raw))
            : raw;
          break;
        }
      }
    }
  }
  if (last_update === null || !/^\d{4}-\d{2}-\d{2}$/.test(last_update))
    throw new Error(
      `no "LAST UPDATE" date read as a date (${last_update ?? "none"})`,
    );

  // Carriers: every heading from column 2 to the legend. A marker under an empty heading
  // beside a named one is that carrier's other space (the Carrack's H and C; the Starlancer's
  // H stands one column before its name).
  const unmatched: string[] = [];
  const carriers: FitCarrier[] = [];
  const claimed = new Set<number>();
  const slotOf = (
    c: number,
  ): { slot: FitCarrier["slot"]; marker: string | null } => {
    const m = text(at(sheet, markers, c));
    return {
      slot: SLOTS[m] ?? null,
      marker: m === "" || SLOTS[m] !== undefined ? null : m,
    };
  };
  const addCarrier = (
    label: string,
    column: number,
    classNames: string[],
  ): void => {
    claimed.add(column);
    carriers.push({
      id: carriers.length,
      label,
      column,
      ...slotOf(column),
      unreleased: unreleasedFrom >= 0 && column >= unreleasedFrom,
      class_names: classNames,
      fabricator: null,
    });
  };
  for (let c = 2; c < legendColumn; c += 1) {
    const label = text(at(sheet, r0, c));
    if (label === "" || claimed.has(c)) continue;
    const classNames = resolveLabel(label, pack, aliases);
    if (classNames.length === 0 && aliases[label] === undefined)
      unmatched.push(label);
    // Only a heading that carries a marker itself has other columns: the Carrack's H and C,
    // the Starlancer's H one column before its name.
    const marked = text(at(sheet, markers, c)) !== "";
    const before = c - 1;
    if (
      marked &&
      before >= 2 &&
      !claimed.has(before) &&
      text(at(sheet, r0, before)) === "" &&
      text(at(sheet, markers, before)) !== ""
    )
      addCarrier(label, before, classNames);
    addCarrier(label, c, classNames);
    let next = c + 1;
    while (
      marked &&
      next < legendColumn &&
      text(at(sheet, r0, next)) === "" &&
      text(at(sheet, markers, next)) !== ""
    ) {
      addCarrier(label, next, classNames);
      next += 1;
    }
  }
  if (carriers.length === 0)
    throw new Error("no carriers under the heading row");

  // Vehicles: the rows below, in the ship section, then the ground section; the rest stops.
  const vehicles: FitVehicle[] = [];
  const fits: ShipFit[] = [];
  let contradictions = 0;
  let group: FitVehicle["group"] = "ship";
  let maker: string | null = null;
  const byFill = legend.verdictByFill;
  for (let r = markers + 1; r < sheet.cells.length; r += 1) {
    const head = text(at(sheet, r, 0));
    const label = text(at(sheet, r, 1));
    if (/^ground$/i.test(head)) {
      group = "ground";
      maker = null;
      continue;
    }
    if (/^other$/i.test(head)) {
      // The sheet's own rows about the carriers follow: "FITS A FABRICATOR?".
      for (let q = r + 1; q < sheet.cells.length; q += 1) {
        const rowLabel = text(at(sheet, q, 1));
        if (/fabricator/i.test(rowLabel)) {
          for (const carrier of carriers) {
            const cell = at(sheet, q, carrier.column);
            const verdict =
              cell?.fill === null || cell === undefined
                ? null
                : (byFill.get(cell.fill) ?? null);
            carriers[carrier.id] = { ...carrier, fabricator: verdict };
          }
        }
        if (/^rumou?rs$/i.test(text(at(sheet, q, 1)))) break;
      }
      break;
    }
    if (/^rumou?rs$/i.test(head) || /^rumou?rs$/i.test(label)) break;
    if (head !== "") maker = head;
    if (label === "") continue;
    const classNames = resolveLabel(label, pack, aliases);
    if (classNames.length === 0 && aliases[label] === undefined)
      unmatched.push(label);
    const vehicle: FitVehicle = {
      id: vehicles.length,
      label,
      maker_label: maker,
      row: r,
      group,
      class_names: classNames,
    };
    vehicles.push(vehicle);
    for (const carrier of carriers) {
      const cell = at(sheet, r, carrier.column);
      if (cell === undefined) continue;
      const mark = text(cell);
      const byColour =
        cell.fill === null ? null : (byFill.get(cell.fill) ?? null);
      const bySymbol: FitVerdict | null =
        mark === "✔" ? "fits" : mark === "X" ? "no" : null;
      const verdict = byColour ?? bySymbol;
      if (verdict === null) continue;
      if (byColour !== null && bySymbol !== null && byColour !== bySymbol)
        contradictions += 1;
      fits.push({
        carrier: carrier.id,
        vehicle: vehicle.id,
        verdict,
        mark: mark === "" || mark === "✔" || mark === "X" ? null : mark,
      });
    }
  }
  if (vehicles.length === 0)
    throw new Error("no vehicle rows under the heading");

  // A name another row names exactly is not a variant of this row ("Cyclone / Variants" beside
  // "Cyclone MT").
  const exactOf = (label: string): Set<string> => {
    const { parts } = splitLabel(label);
    return new Set(
      parts.flatMap((p) =>
        pack.filter((v) => fold(v.name) === fold(p)).map((v) => v.class_name),
      ),
    );
  };
  const trim = <T extends { label: string; class_names: string[] }>(
    rows: T[],
  ): T[] =>
    rows.map((row) => {
      const others = new Set(
        rows.filter((o) => o !== row).flatMap((o) => [...exactOf(o.label)]),
      );
      const own = exactOf(row.label);
      return {
        ...row,
        class_names: row.class_names.filter(
          (c) => own.has(c) || !others.has(c),
        ),
      };
    });

  return {
    build_label,
    last_update,
    legend,
    carriers: trim(carriers),
    vehicles: trim(vehicles),
    fits,
    unmatched: [...new Set(unmatched)],
    contradictions,
  };
}

export function toFixture(
  parsed: ParsedList,
  fetchedAt: string,
  consent: "pending" | "granted",
): ShipFitList {
  return ShipFitList.parse({
    source: {
      title: TITLE,
      url: SHEET_URL,
      author: AUTHOR,
      sheet: SHEET_NAME,
      build_label: parsed.build_label,
      last_update: parsed.last_update,
      consent,
    },
    fetched_at: fetchedAt,
    legend: { verdicts: parsed.legend.verdicts, marks: parsed.legend.marks },
    carriers: parsed.carriers,
    vehicles: parsed.vehicles,
    fits: parsed.fits,
  });
}

async function main(): Promise<void> {
  const runId = randomUUID();
  const started = Date.now();
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, "..", "..");
  const pack = (
    JSON.parse(
      readFileSync(join(root, "fixtures", "bootstrap", "Vehicle.json"), "utf8"),
    ) as PackName[]
  ).map((v) => ({ name: v.name, class_name: v.class_name }));
  const aliases = JSON.parse(
    readFileSync(join(here, "names.json"), "utf8"),
  ) as Record<string, unknown>;
  delete aliases["_"];
  const outDir = join(root, "fixtures", "fitting");
  const file = join(outDir, "ShipFit.json");
  let consent: "pending" | "granted" = "pending";
  try {
    consent = ShipFitList.parse(JSON.parse(readFileSync(file, "utf8"))).source
      .consent;
  } catch {
    // No fixture yet, or an older shape: consent starts as pending.
  }
  const response = await fetch(EXPORT_URL, {
    headers: { "User-Agent": userAgent("data") },
  });
  if (!response.ok)
    throw new Error(`${EXPORT_URL} returned ${response.status}`);
  const sheets = readWorkbook(new Uint8Array(await response.arrayBuffer()));
  const sheet = sheets.find((s) => s.name === SHEET_NAME);
  if (sheet === undefined)
    throw new Error(
      `no sheet named ${SHEET_NAME}; found ${sheets.map((s) => s.name).join(", ")}`,
    );
  const parsed = parseFittingSheet(sheet, pack, aliases as Aliases);
  const fixture = toFixture(parsed, new Date().toISOString(), consent);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({
      run_id: runId,
      job: "fixtures:fitting",
      requests: 1,
      build_label: parsed.build_label,
      last_update: parsed.last_update,
      carriers: parsed.carriers.length,
      vehicles: parsed.vehicles.length,
      fits: parsed.fits.length,
      unmatched: parsed.unmatched,
      contradictions: parsed.contradictions,
      errors: 0,
      duration_ms: Date.now() - started,
    }),
  );
}

if (
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
