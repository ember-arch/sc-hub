import { describe, expect, it } from "vitest";
import {
  type Outcome,
  commitMessage,
  issueText,
  needsRebuild,
  sameIgnoringStamps,
  summaryMarkdown,
  tail,
  withoutStamps,
} from "../refresh/plan.js";

describe("needsRebuild", () => {
  it("rebuilds only for a new build, or when forced", () => {
    expect(needsRebuild("4.10.2-LIVE.1", "4.10.2-LIVE.1", false)).toEqual({
      rebuild: false,
      reason: "build unchanged: 4.10.2-LIVE.1",
    });
    expect(needsRebuild("4.10.2-LIVE.1", "4.10.3-LIVE.2", false).rebuild).toBe(
      true,
    );
    expect(needsRebuild("4.10.2-LIVE.1", "4.10.2-LIVE.1", true)).toEqual({
      rebuild: true,
      reason: "rebuild forced",
    });
    expect(needsRebuild(null, "4.10.2-LIVE.1", false).rebuild).toBe(true);
  });
});

describe("sameIgnoringStamps", () => {
  it("treats a new fetched_at on the same data as no change", () => {
    const a = JSON.stringify([
      { slug: "odin", length_m: 752, fetched_at: "2026-11-09T00:00:00Z" },
    ]);
    const b = JSON.stringify([
      { slug: "odin", length_m: 752, fetched_at: "2026-11-10T00:00:00Z" },
    ]);
    expect(sameIgnoringStamps(a, b)).toBe(true);
  });

  it("sees a change in the data", () => {
    const a = JSON.stringify([
      { slug: "odin", length_m: 752, fetched_at: "x" },
    ]);
    const b = JSON.stringify([
      { slug: "odin", length_m: 760, fetched_at: "y" },
    ]);
    expect(sameIgnoringStamps(a, b)).toBe(false);
  });

  it("sees a new row, a removed file and a new file", () => {
    const a = JSON.stringify([{ day: "2026-11-09", fetched_at: "x" }]);
    const b = JSON.stringify([
      { day: "2026-11-09", fetched_at: "x" },
      { day: "2026-11-10", fetched_at: "y" },
    ]);
    expect(sameIgnoringStamps(a, b)).toBe(false);
    expect(sameIgnoringStamps(a, null)).toBe(false);
    expect(sameIgnoringStamps(null, b)).toBe(false);
    expect(sameIgnoringStamps(null, null)).toBe(true);
  });

  it("compares anything but JSON byte for byte", () => {
    expect(sameIgnoringStamps("# a\n", "# a\n")).toBe(true);
    expect(sameIgnoringStamps("# a\n", "# b\n")).toBe(false);
  });

  it("strips stamps at any depth and nowhere else", () => {
    expect(
      withoutStamps({
        source: { fetched_at: "x", revision_id: 1 },
        rows: [{ fetched_at: "y", value: 2 }],
        updated_at: "kept: RSI's own date",
      }),
    ).toEqual({
      source: { revision_id: 1 },
      rows: [{ value: 2 }],
      updated_at: "kept: RSI's own date",
    });
  });
});

const outcomes: Outcome[] = [
  {
    id: "catalog",
    label: "catalog",
    kind: "changed",
    files: ["fixtures/bootstrap/Vehicle.json"],
    note: "4.10.3-LIVE.2",
  },
  { id: "descriptions", label: "descriptions", kind: "unchanged" },
  {
    id: "ship-matrix",
    label: "ship matrix",
    kind: "skipped",
    reason:
      "needs SC_HUB_CONTACT_EMAIL, the contact address RSI requests carry",
  },
  {
    id: "funding",
    label: "funding",
    kind: "changed",
    files: ["fixtures/funding/Funding.json"],
  },
  {
    id: "titles",
    label: "titles",
    kind: "failed",
    report: '{"error":"TitlesShapeError","message":"unknown table"}',
  },
];

describe("the words the job leaves", () => {
  it("names what changed in the commit message, nothing when nothing did", () => {
    expect(commitMessage("2026-11-10", outcomes)).toBe(
      "data: refresh 2026-11-10: catalog 4.10.3-LIVE.2, funding",
    );
    expect(
      commitMessage("2026-11-10", [
        { id: "a", label: "a", kind: "unchanged" },
        { id: "b", label: "b", kind: "skipped", reason: "r" },
      ]),
    ).toBeNull();
  });

  it("summarises every step and quotes a failure's report", () => {
    const md = summaryMarkdown("2026-11-10", outcomes);
    expect(md).toContain("## Refresh 2026-11-10");
    expect(md).toContain(
      "- catalog: changed (4.10.3-LIVE.2): fixtures/bootstrap/Vehicle.json",
    );
    expect(md).toContain("- descriptions: unchanged");
    expect(md).toContain("- ship matrix: skipped, needs SC_HUB_CONTACT_EMAIL");
    expect(md).toContain("- titles: **failed**");
    expect(md).toContain("unknown table");
  });

  it("writes an issue only for a failure, with the report and the run", () => {
    const issue = issueText(
      "2026-11-10",
      outcomes,
      "https://example.test/run/1",
    );
    expect(issue?.title).toBe("Refresh needs attention: titles");
    expect(issue?.body).toContain("### titles");
    expect(issue?.body).toContain("unknown table");
    expect(issue?.body).toContain("https://example.test/run/1");
    expect(issue?.body).toContain("do not edit the fixtures by hand");
    expect(
      issueText(
        "2026-11-10",
        [{ id: "a", label: "a", kind: "unchanged" }],
        null,
      ),
    ).toBeNull();
  });

  it("keeps the last lines of a report", () => {
    expect(tail("a\n\nb\nc\n", 2)).toBe("b\nc");
  });
});
