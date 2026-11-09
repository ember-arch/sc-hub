import { describe, expect, it } from "vitest";
import { appendRows, pinSlugs } from "../bootstrap-fixtures/append.js";

// ADR-016; CLAUDE.md sections 2 and 5: regenerating the bootstrap pack for the same build keeps every
// published row byte for byte and every published slug with its class name.

describe("appendRows", () => {
  it("keeps every previous row unchanged and adds only rows it did not have", () => {
    const previous = [
      { class_name: "A", slug: "a", updated_at: "old" },
      { class_name: "B", slug: "b", updated_at: "old" },
    ];
    const next = [
      { class_name: "B", slug: "b", updated_at: "new" },
      { class_name: "C", slug: "c", updated_at: "new" },
    ];
    expect(appendRows("Item", previous, next)).toEqual([
      { class_name: "A", slug: "a", updated_at: "old" },
      { class_name: "B", slug: "b", updated_at: "old" },
      { class_name: "C", slug: "c", updated_at: "new" },
    ]);
  });

  it("keys ports by ship, build and port path", () => {
    const port = (path: string, item: string) => ({
      class_name: "S",
      channel: "LIVE",
      game_version: "1",
      port_path: path,
      item,
    });
    expect(
      appendRows(
        "Port",
        [port("a", "old")],
        [port("a", "new"), port("b", "new")],
      ),
    ).toEqual([port("a", "old"), port("b", "new")]);
  });
});

describe("pinSlugs", () => {
  const published = new Map([
    ["RSI_Serac", "serac"],
    ["KLWE_Badger", "cf-227-badger-repeater"],
  ]);

  it("keeps a published slug even when a fresh derivation would change it", () => {
    const out = pinSlugs(
      new Map([["RSI_Serac", "rsi-serac"]]),
      published,
      () => [],
    );
    expect(out.get("RSI_Serac")).toBe("serac");
  });

  it("moves a new part off a slug an existing part holds", () => {
    const out = pinSlugs(new Map([["WCPR_Serac", "serac"]]), published, () => [
      "wcpr-serac",
      "wcpr-serac-class",
    ]);
    expect(out.get("WCPR_Serac")).toBe("wcpr-serac");
  });

  it("halts when no candidate is free", () => {
    expect(() =>
      pinSlugs(new Map([["X", "serac"]]), published, () => ["serac"]),
    ).toThrow(/no free slug/);
  });
});
