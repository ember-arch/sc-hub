import { describe, expect, it } from "vitest";
import { isHeadingLine, parseArticle, sentenceCase } from "../media/article.js";

// The shape of the wiki API's Comm-Link text, with placeholder words (no network, no CIG text).
const TEXT = [
  "Key_Background_2 THE FIRST HEADING",
  "",
  "First paragraph of the opening, long enough to count as body text here.",
  "Second paragraph of the opening, also long enough to count as body text.",
  "THE SECOND",
  "Kicker words",
  "A paragraph that belongs to the second chapter and nothing else at all.",
  "SOME-IMAGE THE THIRD ONE",
  "Another kicker",
  "Body of the third chapter, which stops before the junk line that follows.",
  "Odin_Schematic_A Odin_Schematic_B",
  "THE SECOND",
  "Kicker words",
  "A repeated block the parser must ignore because the first one wins.",
].join("\n");

describe("parseArticle", () => {
  it("returns each heading's kicker and paragraphs, verbatim and in the asked order", () => {
    const chapters = parseArticle(TEXT, [
      "THE THIRD ONE",
      "THE FIRST HEADING",
      "THE SECOND",
    ]);
    expect(chapters.map((c) => c.heading)).toEqual([
      "THE THIRD ONE",
      "THE FIRST HEADING",
      "THE SECOND",
    ]);
    expect(chapters[0]).toEqual({
      heading: "THE THIRD ONE",
      kicker: "Another kicker",
      text: [
        "Body of the third chapter, which stops before the junk line that follows.",
      ],
    });
    expect(chapters[1]?.kicker).toBeNull();
    expect(chapters[1]?.text).toHaveLength(2);
    expect(chapters[2]?.text).toEqual([
      "A paragraph that belongs to the second chapter and nothing else at all.",
    ]);
  });

  it("skips headings the article does not have", () => {
    expect(parseArticle(TEXT, ["NOT THERE"])).toEqual([]);
  });

  it("matches a heading with dashes in its first word", () => {
    const chapters = parseArticle(
      "ALL-ROUND PERFORMANCE\nGuns\nA paragraph long enough to be body text for this chapter.",
      ["ALL-ROUND PERFORMANCE"],
    );
    expect(chapters[0]?.kicker).toBe("Guns");
  });
});

describe("isHeadingLine", () => {
  it("ignores file-name tokens and needs capital words", () => {
    expect(isHeadingLine("SC_ANVIL_Odin_Exterior-7 RENEWED STRENGTH")).toBe(
      true,
    );
    expect(isHeadingLine("Central Hangar")).toBe(false);
    expect(isHeadingLine("2x Manned 2x S8, 2x S3")).toBe(false);
  });
});

describe("sentenceCase", () => {
  it("lower-cases all but the first letter", () => {
    expect(sentenceCase("THE ALL-KILLING EYE")).toBe("The all-killing eye");
  });
});
