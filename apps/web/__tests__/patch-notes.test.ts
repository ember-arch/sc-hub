import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ContentItem } from "schema";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../lib/data";
import {
  hotfixSections,
  noteSections,
  notesFor,
  paragraphs,
  patchNotes,
  readTitle,
} from "../lib/patch-notes";

// CIG's patch notes as the patch pages lay them out (ADR-049), on the committed news pack.

const rows = ContentItem.array().parse(
  JSON.parse(
    readFileSync(
      join(REPO_ROOT, "fixtures", "news", "ContentItem.json"),
      "utf8",
    ),
  ),
);
const notes = patchNotes(rows);

describe("readTitle", () => {
  it("reads version, channel, build, audience and release candidate", () => {
    expect(
      readTitle(
        "[All Waves] Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes 13160301",
      ),
    ).toEqual({
      version: "4.10.3",
      channel: "PTU",
      build: "13160301",
      audience: "All Waves",
      releaseCandidate: "RC1",
      hotfix: false,
    });
    // "4.10" is 4.10.0.
    expect(
      readTitle("[Wave 1] Star Citizen Alpha 4.10 PTU Patch Notes 12311913")
        ?.version,
    ).toBe("4.10.0");
    expect(
      readTitle(
        "Star Citizen Alpha 4.10.2 LIVE - Hotfix Central  (Updated 10.17.2026)",
      ),
    ).toMatchObject({ channel: "LIVE", hotfix: true, build: null });
    expect(readTitle("Spectrum Redesign: Phase 1 Now Live")).toBeNull();
  });
});

describe("noteSections", () => {
  it("recovers CIG's sections and the headings inside features, and keeps fix lists flat", () => {
    const { facts, sections } = noteSections([
      "Alpha Patch 4.10.2 has been released and is now available to test on the PTU environment!",
      "Audience: Wave 1",
      "Server Info: PTU Channel - US Only",
      "Testing/Feedback Focus",
      "Stability, Bugfixes, LTP between PTU releases",
      "New Event missions in Stanton",
      "Features & Updates",
      "Shield Resistance",
      "Shield resistance values now function correctly when minimum and maximum resistance are set to the same value.",
      "Bug Fixes & Technical",
      "2 Client Crashes Fixed",
      "Potential Fix: Client crash in the chat",
      "Further final performance and logging updates",
      "Potential Fix: Vehicles failing to spawn",
    ]);
    expect(facts).toEqual([
      { label: "Audience", value: "Wave 1" },
      { label: "Server Info", value: "PTU Channel - US Only" },
    ]);
    expect(sections.map((s) => s.title)).toEqual([
      "Testing/Feedback Focus",
      "Features & Updates",
      "Bug Fixes & Technical",
    ]);
    expect(sections[0]?.groups).toEqual([
      {
        title: null,
        items: [
          "Stability, Bugfixes, LTP between PTU releases",
          "New Event missions in Stanton",
        ],
      },
    ]);
    expect(sections[1]?.groups.map((g) => g.title)).toEqual([
      "Shield Resistance",
    ]);
    expect(sections[2]?.groups).toEqual([
      {
        title: "2 Client Crashes Fixed",
        items: [
          "Potential Fix: Client crash in the chat",
          "Further final performance and logging updates",
          "Potential Fix: Vehicles failing to spawn",
        ],
      },
    ]);
  });
});

describe("noteSections with the post's list items", () => {
  it("never makes a heading of a list item, however short", () => {
    const lines = [
      "Features & Updates",
      "Ship Balance",
      "Reduced the Gladius spool time",
      "Shorter line",
      "A longer line that follows the short list item above it",
    ];
    const { sections } = noteSections(lines, new Set([2, 3]));
    expect(sections[0]?.groups.map((g) => g.title)).toEqual(["Ship Balance"]);
    expect(sections[0]?.groups[0]?.items).toEqual([
      "Reduced the Gladius spool time",
      "Shorter line",
      "A longer line that follows the short list item above it",
    ]);
  });
});

describe("hotfixSections", () => {
  it("makes the status lines facts and each dated entry a group, dropping bare addresses", () => {
    const { facts, sections } = hotfixSections([
      "Hi Everyone!",
      "Status: Hotfix Channel Currently CLOSED",
      "► 10.14.2026: DGS Hotfix 12939222 - Canaried onto multiple shards for testing",
      "This DGS side hotfix contains multiple server crash fixes.",
      "https://issue-council.robertsspaceindustries.com/projects/STAR-CITIZEN",
    ]);
    expect(facts).toEqual([
      { label: "Status", value: "Hotfix Channel Currently CLOSED" },
    ]);
    expect(sections).toEqual([
      {
        title: "Hotfixes",
        groups: [
          {
            title:
              "10.14.2026: DGS Hotfix 12939222 - Canaried onto multiple shards for testing",
            items: [
              "This DGS side hotfix contains multiple server crash fixes.",
            ],
          },
        ],
      },
    ]);
  });
});

describe("patchNotes on the news pack", () => {
  it("finds the posts for a patch, each once, newest first", () => {
    const ptu = notesFor(notes, "4.10.3", "PTU");
    expect(ptu.length).toBeGreaterThan(0);
    const titles = ptu.map((n) => n.title);
    expect(new Set(titles).size).toBe(titles.length);
    const times = ptu.map((n) => n.publishedAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it("lays out a post read in full and links one held as a single run of text", () => {
    const full = notes.find((n) => n.title.includes("13160301"));
    expect(full?.flat).toBe(false);
    expect(full?.sections[0]?.title).toMatch(/bug ?fixes/i);
    const flat = notes.find((n) => n.title.includes("12311913"));
    expect(flat?.flat).toBe(true);
  });

  it("links RSI's official notes rather than laying out a page that arrives with filler text", () => {
    const official = notes.find((n) => n.kind === "official");
    expect(official?.flat).toBe(true);
    expect(official?.channel).toBe("LIVE");
  });

  it("reads paragraphs and list items as lines, entities decoded", () => {
    expect(
      paragraphs(
        "<p>Bug Fixes &amp; Technical</p><ul><li>Fixed &quot;x&quot;</li></ul>",
      ),
    ).toEqual(["Bug Fixes & Technical", 'Fixed "x"']);
  });
});
