import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  firstParagraph,
  paragraphsHtml,
  sanitizeHtml,
} from "../src/html.js";
import { type Incoming, openStore, stableId } from "../src/store.js";

const item = (over: Partial<Incoming> = {}): Incoming => ({
  source: "comm_link",
  external_id: "1",
  url: "https://robertsspaceindustries.com/comm-link/transmission/1-One",
  title: "One",
  summary: "First paragraph.",
  body_html: "<p>First paragraph.</p>",
  published_at: "2026-11-10T00:00:00.000Z",
  author_id: null,
  thread_id: null,
  thread_title: null,
  forum: null,
  ...over,
});

describe("the news store", () => {
  it("adds a new item at revision 1 with a stable id, repeats nothing, and revises a change", () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const path = join(dir, "ContentItem.json");
    const store = openStore(path);
    expect(store.put(item(), "2026-11-10T00:01:00.000Z")).toBe("new");
    expect(store.put(item(), "2026-11-10T00:16:00.000Z")).toBe("unchanged");
    expect(
      store.put(item({ title: "One, edited" }), "2026-11-10T00:31:00.000Z"),
    ).toBe("revised");
    expect(store.rows).toHaveLength(2);
    expect(store.rows[1]?.revision).toBe(2);
    expect(store.rows[0]?.id).toBe(stableId("comm_link:1:1"));
    expect(store.rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(store.latest()).toHaveLength(1);
    expect(store.latest()[0]?.title).toBe("One, edited");
    expect(store.save()).toBe(true);
    const reopened = openStore(path);
    expect(reopened.rows).toHaveLength(2);
    expect(reopened.find("comm_link", "1")?.revision).toBe(2);
    expect(JSON.parse(readFileSync(path, "utf8"))).toHaveLength(2);
    expect(reopened.save()).toBe(false);
  });

  it("records nothing published before the news window, and answers older (ADR-030)", () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    expect(
      store.put(
        item({ published_at: "2026-05-13T23:59:59.000Z" }),
        "2026-11-10T00:01:00.000Z",
      ),
    ).toBe("older");
    expect(
      store.put(
        item({ published_at: "2026-05-14T00:00:00.000Z" }),
        "2026-11-10T00:01:00.000Z",
      ),
    ).toBe("new");
    expect(store.rows).toHaveLength(1);
    expect(store.added).toBe(1);
  });

  it("keeps a takedown flag across revisions", () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    store.put(item(), "2026-11-10T00:01:00.000Z");
    (store.rows[0] as { takedown: boolean }).takedown = true;
    store.put(item({ title: "edited" }), "2026-11-10T00:31:00.000Z");
    expect(store.rows[1]?.takedown).toBe(true);
  });
});

describe("html helpers", () => {
  it("escapes text and makes paragraphs", () => {
    expect(escapeHtml(`<a href="x">&</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;",
    );
    expect(paragraphsHtml("One.\n\nTwo <b>.\nThree.")).toBe(
      "<p>One.</p>\n<p>Two &lt;b&gt;.</p>\n<p>Three.</p>",
    );
    expect(firstParagraph("\n\n  Lead.\nMore.")).toBe("Lead.");
    expect(firstParagraph("   ")).toBeNull();
  });

  it("keeps only the allowed tags, safe links and images from the source's hosts", () => {
    const dirty = `<div onclick="x()"><h2>Title</h2><script>alert(1)</script><p>Text <a href="javascript:evil()">bad</a> <a href="https://robertsspaceindustries.com/x">good</a></p><img src="https://evil.example/i.png"><img src="https://media.robertsspaceindustries.com/i.jpg" alt="Ship"><iframe src="x"></iframe></div>`;
    expect(sanitizeHtml(dirty, ["media.robertsspaceindustries.com"])).toBe(
      `<h2>Title</h2><p>Text <a>bad</a> <a href="https://robertsspaceindustries.com/x">good</a></p><img src="https://media.robertsspaceindustries.com/i.jpg" alt="Ship">`,
    );
  });
});
