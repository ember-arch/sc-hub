import { describe, expect, it } from "vitest";
import { GET } from "../app/search-index.json/route";
import { SEARCH_INDEX_PATH, searchIndex } from "../lib/search-index";

describe("the search index document", () => {
  it("lists every ship entry, named part, maker and title once, with a name and a link", async () => {
    const entries = searchIndex();
    expect(entries.length).toBeGreaterThan(200);
    for (const e of entries) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.href.startsWith("/")).toBe(true);
      expect(["ship", "component", "manufacturer", "title"]).toContain(e.type);
    }
    expect(new Set(entries.map((e) => e.href)).size).toBe(entries.length);
    // A part without a name of its own (shown under its class name) is not searched for.
    expect(entries.some((e) => /^[A-Z0-9]+_[A-Za-z0-9_]+$/.test(e.name))).toBe(
      false,
    );
  });

  it("is served as cacheable JSON at the palette's address", async () => {
    expect(SEARCH_INDEX_PATH).toBe("/search-index.json");
    const response = GET();
    expect(response.headers.get("content-type")).toMatch(/json/);
    expect(response.headers.get("cache-control")).toMatch(/max-age/);
    const body: unknown = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect((body as unknown[]).length).toBe(searchIndex().length);
  });
});
