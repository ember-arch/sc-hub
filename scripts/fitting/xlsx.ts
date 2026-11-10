/**
 * A small reader for the cells of an .xlsx workbook: each cell's text and the solid fill behind
 * it, which is where the fitting list keeps its meaning (ADR-028). Only what the fitting script
 * needs: shared and inline strings, numbers as written, and the fill of each cell's style.
 */
import { strFromU8, unzipSync } from "fflate";

export interface Cell {
  readonly v: string;
  /** The solid fill's colour as "RRGGBB", or null without one. */
  readonly fill: string | null;
}

export interface Sheet {
  readonly name: string;
  /** Rows of cells, sparse: a missing row or cell is undefined. */
  readonly cells: readonly (readonly (Cell | undefined)[] | undefined)[];
}

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const textOf = (xml: string): string =>
  decode(
    [...xml.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((m) => m[1] ?? "").join(""),
  );

/** "AB" of "AB12" as a zero-based column index. */
export function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, ""))
    n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** The fill colour of a `<fill>` element: an rgb without its alpha byte, or null. */
function fillColour(xml: string): string | null {
  if (!/patternType="solid"/.test(xml)) return null;
  const rgb = /fgColor rgb="([0-9A-Fa-f]{6,8})"/.exec(xml)?.[1];
  return rgb === undefined ? null : rgb.slice(-6).toUpperCase();
}

export function readWorkbook(bytes: Uint8Array): Sheet[] {
  const zip = unzipSync(bytes);
  const file = (name: string): string => {
    const entry = zip[name];
    if (entry === undefined) throw new Error(`workbook has no ${name}`);
    return strFromU8(entry);
  };
  const workbook = file("xl/workbook.xml");
  const rels = file("xl/_rels/workbook.xml.rels");
  const shared = zip["xl/sharedStrings.xml"]
    ? [...file("xl/sharedStrings.xml").matchAll(/<si>(.*?)<\/si>/gs)].map((m) =>
        textOf(m[1] ?? ""),
      )
    : [];
  const styles = zip["xl/styles.xml"] ? file("xl/styles.xml") : "";
  const fills = [
    ...(/<fills[^>]*>(.*?)<\/fills>/s.exec(styles)?.[1] ?? "").matchAll(
      /<fill>(.*?)<\/fill>/gs,
    ),
  ].map((m) => fillColour(m[1] ?? ""));
  const xfs = [
    ...(/<cellXfs[^>]*>(.*?)<\/cellXfs>/s.exec(styles)?.[1] ?? "").matchAll(
      /<xf [^>]*>/g,
    ),
  ].map((m) => Number(/fillId="(\d+)"/.exec(m[0])?.[1] ?? 0));

  const sheets: Sheet[] = [];
  for (const s of workbook.matchAll(
    /<sheet [^>]*name="([^"]*)"[^>]*r:id="([^"]*)"/g,
  )) {
    const name = decode(s[1] ?? "");
    const rid = s[2] ?? "";
    const rel =
      new RegExp(`<Relationship [^>]*Id="${rid}"[^>]*Target="([^"]*)"`).exec(
        rels,
      ) ??
      new RegExp(`<Relationship [^>]*Target="([^"]*)"[^>]*Id="${rid}"`).exec(
        rels,
      );
    const target = rel?.[1];
    if (target === undefined) throw new Error(`sheet ${name} has no part`);
    const path = target.startsWith("/")
      ? target.slice(1)
      : `xl/${target.replace(/^xl\//, "")}`;
    const xml = file(path);
    const cells: (Cell | undefined)[][] = [];
    for (const row of xml.matchAll(/<row [^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
      const r = Number(row[1]) - 1;
      const line: (Cell | undefined)[] = [];
      for (const c of (row[2] ?? "").matchAll(
        /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>(.*?)<\/c>)/gs,
      )) {
        const attrs = c[2] ?? "";
        const inner = c[3] ?? "";
        const styleIndex = Number(/s="(\d+)"/.exec(attrs)?.[1] ?? -1);
        const type = /t="([^"]+)"/.exec(attrs)?.[1];
        let v = /<v>(.*?)<\/v>/s.exec(inner)?.[1] ?? "";
        if (type === "s") v = shared[Number(v)] ?? "";
        else if (type === "inlineStr") v = textOf(inner);
        else v = decode(v);
        const fill =
          styleIndex >= 0 ? (fills[xfs[styleIndex] ?? 0] ?? null) : null;
        line[columnIndex(c[1] ?? "A1")] = { v, fill };
      }
      cells[r] = line;
    }
    sheets.push({ name, cells });
  }
  return sheets;
}

/** An Excel serial date as an ISO date; the epoch is 1899-12-30. */
export function serialToIsoDate(serial: number): string {
  const ms = Math.round(serial) * 86_400_000 + Date.UTC(1899, 11, 30);
  return new Date(ms).toISOString().slice(0, 10);
}
