import { ContentItem } from "schema";
import { describe, expect, it } from "vitest";
import { buildRepository, visibleNews } from "../lib/data";
import { bootstrapPack } from "./pack";

// The one mechanism the Spectrum approval depends on (ADR-027): with the module off, no Spectrum
// item reaches a page whatever the pack holds; a taken-down author's posts stay hidden either way.

const AUTHOR = "a0000000-0000-5000-8000-000000000001";

function item(n: number, fields: Partial<ContentItem>): ContentItem {
  return ContentItem.parse({
    id: `b0000000-0000-5000-8000-00000000000${n}`,
    source: "comm_link",
    external_id: String(n),
    url: `https://robertsspaceindustries.com/comm-link/transmission/${n}`,
    title: `Item ${n}`,
    summary: null,
    body_html: "",
    published_at: `2026-11-0${n}T00:00:00.000Z`,
    fetched_at: "2026-11-10T00:00:00.000Z",
    revision: 1,
    author_id: null,
    thread_id: null,
    thread_title: null,
    forum: null,
    takedown: false,
    ...fields,
  });
}

const rows = [
  item(1, {}),
  item(2, {
    source: "spectrum",
    url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/x",
    author_id: AUTHOR,
    thread_id: "t",
  }),
  item(3, {
    source: "spectrum",
    url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/1/thread/y",
    author_id: "a0000000-0000-5000-8000-000000000002",
    thread_id: "u",
  }),
  item(4, { takedown: true }),
  {
    ...item(1, {}),
    id: "b0000000-0000-5000-8000-000000000009",
    revision: 2,
    title: "Item 1, revised",
  },
];

describe("visibleNews", () => {
  it("shows no Spectrum item with the module off, and only the latest revision of each item", () => {
    const shown = visibleNews(rows, {
      spectrum: false,
      hiddenAuthors: new Set(),
    });
    expect(shown.map((r) => r.title)).toEqual(["Item 1, revised"]);
  });

  it("shows Spectrum items with the module on, newest first, except by an author under takedown", () => {
    const on = visibleNews(rows, { spectrum: true, hiddenAuthors: new Set() });
    expect(on.map((r) => r.external_id)).toEqual(["3", "2", "1"]);
    const hidden = visibleNews(rows, {
      spectrum: true,
      hiddenAuthors: new Set([AUTHOR]),
    });
    expect(hidden.map((r) => r.external_id)).toEqual(["3", "1"]);
  });
});

describe("the dispatches", () => {
  it("never count a Spectrum item, with the module on or off (ADR-029)", () => {
    const on = visibleNews(rows, { spectrum: true, hiddenAuthors: new Set() });
    const r = buildRepository(bootstrapPack(), on);
    expect(r.news.map((n) => n.external_id)).toEqual(["3", "2", "1"]);
    expect(r.dispatches.map((n) => n.external_id)).toEqual(["1"]);
    const off = buildRepository(
      bootstrapPack(),
      visibleNews(rows, { spectrum: false, hiddenAuthors: new Set() }),
    );
    expect(off.dispatches.map((n) => n.external_id)).toEqual(["1"]);
  });
});
