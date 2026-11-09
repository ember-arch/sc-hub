import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LOANER_ARTICLE_URL,
  checkLoanerMatrix,
  cellText,
  parseLoanerArticle,
  parseLoanerRows,
  sameMatrix,
  statedUpdate,
} from "../bootstrap-fixtures/loaners.js";

// ADR-015: RSI's loaner matrix is copied whole from its help centre; an unknown table halts the run.

const sample: unknown = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      "..",
      "..",
      "fixtures",
      "acquisition",
      "samples",
      "loaner-article.json",
    ),
    "utf8",
  ),
);
const AT = "2026-11-08T12:00:00.000Z";

describe("RSI loaner matrix", () => {
  it("reads every row once, after the header, with the loaners split at commas", () => {
    const matrix = parseLoanerArticle(sample, AT);
    expect(matrix.rows).toEqual([
      {
        ships: "Carrack / Carrack Expedition",
        loaners: ["C8 Pisces", "URSA Rover"],
      },
      { ships: "Fury Variants", loaners: ["Mustang Alpha"] },
      {
        ships: "Idris-M & P",
        loaners: ["F7C-M Super Hornet", "MPUV Passenger"],
      },
      { ships: "Odin", loaners: ["Idris-P"] },
    ]);
    expect(matrix.article_url).toBe(LOANER_ARTICLE_URL);
    expect(matrix.stated_date).toBe("August 26th, 2026");
    expect(matrix.stated_build).toBe("4.10.0-live.12519617");
    expect(matrix.fetched_at).toBe(AT);
  });

  it("decodes entities and drops markup inside a cell", () => {
    expect(cellText("Idris-M &amp; P<br>&nbsp;<strong>x</strong>&#39;s")).toBe(
      "Idris-M & P x's",
    );
  });

  it("halts on a row that is not two cells, and on a table with no rows", () => {
    expect(() =>
      parseLoanerRows("<table><tr><td>A</td><td>B</td><td>C</td></tr></table>"),
    ).toThrow(/3 cells/);
    expect(() =>
      parseLoanerRows(
        "<table><tr><th>YOUR SHIP</th><th>OUR LOANER(S)</th></tr></table>",
      ),
    ).toThrow(/no rows/);
    expect(() =>
      parseLoanerRows("<table><tr><td>Odin</td><td> </td></tr></table>"),
    ).toThrow(/incomplete/);
  });

  it("finds no stated update in a body without one", () => {
    expect(statedUpdate("<p>No date here</p>")).toEqual({
      date: null,
      build: null,
    });
  });

  it("treats two copies that differ only in when they were fetched as the same", () => {
    const a = parseLoanerArticle(sample, AT);
    const b = parseLoanerArticle(sample, "2026-11-15T12:00:00.000Z");
    expect(sameMatrix(a, b)).toBe(true);
    expect(
      sameMatrix(a, { ...b, rows: [{ ships: "Odin", loaners: ["Idris-M"] }] }),
    ).toBe(false);
  });
});

describe("checkLoanerMatrix", () => {
  const fake =
    (status = 200) =>
    async (url: string, init: { headers: Record<string, string> }) => {
      expect(url).toMatch(/360003093114\.json$/);
      expect(init.headers["User-Agent"]).toContain("ops@example.org");
      return { ok: status === 200, status, json: async () => sample };
    };

  it("reports a change when nothing is on file, and none for the same article", async () => {
    const first = await checkLoanerMatrix(
      fake(),
      null,
      "sc-hub-data/0.0 (ops@example.org)",
      () => AT,
    );
    expect(first.changed).toBe(true);
    const again = await checkLoanerMatrix(
      fake(),
      first.next,
      "sc-hub-data/0.0 (ops@example.org)",
      () => "2026-11-15T00:00:00.000Z",
    );
    expect(again.changed).toBe(false);
  });

  it("halts on an error from the help centre", async () => {
    await expect(
      checkLoanerMatrix(
        fake(503),
        null,
        "sc-hub-data/0.0 (ops@example.org)",
        () => AT,
      ),
    ).rejects.toThrow(/503/);
  });
});
