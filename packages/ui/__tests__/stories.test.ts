import { describe, expect, it } from "vitest";
import { storyMeta } from "../stories/ids";

// stories/index.tsx is JSX and needs React to load; this file only checks the id list is sane.
// The gallery e2e spec imports storyMeta, and the gallery route renders stories/index.tsx, so a
// story missing from either side fails there with a 404 or a missing screenshot.

describe("story ids", () => {
  it("are unique kebab-case ids with a token-sized width", () => {
    const ids = storyMeta.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { id, width } of storyMeta) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect([390, 1280]).toContain(width);
    }
  });
});
