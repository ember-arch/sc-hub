import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type FetchLike, createClient } from "../src/client.js";
import {
  type CommLinkState,
  HUB_URL,
  backfillCommLinks,
  cleanWikiText,
  entryFromRecord,
  HubShapeError,
  WIKI_API,
  WikiCommLink,
  fromHub,
  fromWiki,
  parseHub,
  pollCommLinks,
  timeFromAgo,
} from "../src/sources/comm-link.js";
import { openStore } from "../src/store.js";

const samples = new URL("../../../fixtures/news/samples/", import.meta.url);
const hub = readFileSync(new URL("comm-link-hub.sample.html", samples), "utf8");
const wiki21431 = readFileSync(
  new URL("wiki-comm-link-21431.sample.json", samples),
  "utf8",
);
const wikiList = readFileSync(
  new URL("wiki-comm-links-list.sample.json", samples),
  "utf8",
);
const T0 = new Date("2026-11-10T06:00:00.000Z");

describe("parseHub", () => {
  it("reads every transmission block on RSI's hub page, newest first, with its title", () => {
    const entries = parseHub(hub);
    expect(entries.length).toBeGreaterThanOrEqual(8);
    expect(entries[0]).toMatchObject({
      id: "21445",
      path: "/comm-link/transmission/21445-This-Week-In-Star-Citizen",
      title: "This Week in Star Citizen - November 9, 2026",
      kind: "post",
      timeAgo: "8 hours ago",
    });
    expect(entries[0]?.blurb).toMatch(/^Happy Monday, everyone! Let’s see/);
    expect(entries.some((e) => e.kind === "video")).toBe(true);
    expect(entries.map((e) => e.id)).toContain("21431");
  });

  it("halts on a page without transmission blocks", () => {
    expect(() => parseHub("<html><body>maintenance</body></html>")).toThrow(
      HubShapeError,
    );
  });
});

describe("timeFromAgo and fromHub", () => {
  it("turns the hub's relative time into a time at the hub's own precision", () => {
    expect(timeFromAgo("8 hours ago", T0)?.toISOString()).toBe(
      "2026-11-09T22:00:00.000Z",
    );
    expect(timeFromAgo("an hour ago", T0)?.toISOString()).toBe(
      "2026-11-10T05:00:00.000Z",
    );
    expect(timeFromAgo("1 week ago", T0)?.toISOString()).toBe(
      "2026-11-03T00:00:00.000Z",
    );
    expect(timeFromAgo("yesterday", T0)).toBeNull();
    expect(timeFromAgo(null, T0)).toBeNull();
  });

  it("makes an item from the hub alone: RSI's title, blurb and link", () => {
    const item = fromHub(parseHub(hub)[0]!, T0);
    expect(item).toMatchObject({
      source: "comm_link",
      external_id: "21445",
      title: "This Week in Star Citizen - November 9, 2026",
      url: "https://robertsspaceindustries.com/comm-link/transmission/21445-This-Week-In-Star-Citizen",
      published_at: "2026-11-09T22:00:00.000Z",
    });
    expect(item.body_html).toMatch(/^<p>Happy Monday/);
  });
});

describe("fromWiki", () => {
  it("revises the item with the wiki's paragraphs, first paragraph and exact time", () => {
    const record = WikiCommLink.parse(JSON.parse(wiki21431));
    const entry = parseHub(hub).find((e) => e.id === "21431")!;
    const item = fromWiki(record, entry);
    expect(item).toMatchObject({
      source: "comm_link",
      external_id: "21431",
      url: "https://robertsspaceindustries.com/comm-link/transmission/21431-This-Week-In-Star-Citizen",
      title: entry.title,
      published_at: "2026-11-02T20:00:00.000Z",
    });
    expect(item.summary).toMatch(/^xē'suelen nyahyan, hello everyone/);
    expect(item.body_html.startsWith("<p>")).toBe(true);
    expect(item.body_html).not.toContain("<script");
    expect(item.body_html).toContain("Alpha 4.10.3");
  });
});

describe("pollCommLinks", () => {
  const fetchFixtures =
    (missing: readonly string[] = []): FetchLike =>
    async (url) => {
      if (url === HUB_URL)
        return { ok: true, status: 200, text: async () => hub };
      const id = /comm-links\/(\d+)$/.exec(url)?.[1];
      if (id === "21431")
        return { ok: true, status: 200, text: async () => wiki21431 };
      if (id !== undefined && missing.includes(id)) {
        return { ok: false, status: 404, text: async () => "" };
      }
      if (id !== undefined) {
        const j = JSON.parse(wiki21431) as { data: { id: number } };
        j.data.id = Number(id);
        return { ok: true, status: 200, text: async () => JSON.stringify(j) };
      }
      throw new Error(`unexpected ${url}`);
    };
  const quiet = { sleep: async () => undefined, now: () => 0 };
  const memory = () => {
    let saved: CommLinkState = {};
    return {
      read: () => ({ ...saved }),
      write: (n: CommLinkState) => {
        saved = n;
      },
      get saved() {
        return saved;
      },
    };
  };

  it("adds every hub entry at once, then asks the wiki for its text and revises what it has", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    const state = memory();
    const client = createClient({
      fetch: fetchFixtures(["21447"]),
      contact: "x@example.com",
      ...quiet,
    });
    const summary = await pollCommLinks(client, store, state, () => T0);
    expect(summary.seen).toBeGreaterThanOrEqual(8);
    expect(summary.added).toBe(summary.seen);
    expect(summary.waiting).toEqual(["21447"]);
    // Every entry the wiki has was revised with its text; the one it has not keeps the hub's.
    expect(summary.revised).toBe(summary.seen - 1);
    expect(store.find("comm_link", "21431")?.revision).toBe(2);
    expect(store.find("comm_link", "21431")?.published_at).toBe(
      "2026-11-02T20:00:00.000Z",
    );
    expect(store.find("comm_link", "21447")?.revision).toBe(1);
    expect(state.saved["21447"]?.wiki).toBe(false);
    expect(state.saved["21431"]?.wiki).toBe(true);
    expect(client.requests).toBe(1 + summary.seen);
    // The next run asks only for the one still waiting.
    const again = await pollCommLinks(
      client,
      store,
      state,
      () => new Date(T0.getTime() + 900_000),
    );
    expect(again.asked).toBe(1);
    expect(again.added).toBe(0);
    expect(again.revised).toBe(0);
  });

  it("stops asking the wiki for an item a fortnight after it appeared", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    const state = memory();
    const client = createClient({
      fetch: fetchFixtures(["21447"]),
      contact: "x@example.com",
      ...quiet,
    });
    await pollCommLinks(client, store, state, () => T0);
    const later = new Date(T0.getTime() + 15 * 86_400_000);
    const run = await pollCommLinks(client, store, state, () => later);
    expect(run.asked).toBe(0);
    expect(run.waiting).toEqual([]);
  });

  it("refuses to call RSI without a contact address", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    const client = createClient({
      fetch: fetchFixtures(),
      contact: null,
      ...quiet,
    });
    await expect(
      pollCommLinks(client, store, memory(), () => T0),
    ).rejects.toThrow(/SC_HUB_CONTACT_EMAIL/);
  });

  it("spaces the wiki's requests two seconds apart", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    let clock = 0;
    const waits: number[] = [];
    const client = createClient({
      fetch: fetchFixtures(),
      contact: "x@example.com",
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
      now: () => clock,
    });
    await pollCommLinks(client, store, memory(), () => T0);
    expect(waits.every((w) => w === 2_000)).toBe(true);
    expect(waits.length).toBeGreaterThan(5);
    expect(WIKI_API).toContain("api.star-citizen.wiki");
  });
});

describe("backfillCommLinks", () => {
  it("reads the wiki's list pages and adds every Comm-Link not on record with its text and time", async () => {
    const dir = mkdtempSync(join(tmpdir(), "news-"));
    const store = openStore(join(dir, "ContentItem.json"));
    let saved: CommLinkState = {};
    const state = {
      read: () => ({ ...saved }),
      write: (n: CommLinkState) => {
        saved = n;
      },
    };
    const client = createClient({
      fetch: async (url) => {
        if (!url.startsWith(WIKI_API + "/comm-links?page%5Bnumber%5D="))
          throw new Error(url);
        return { ok: true, status: 200, text: async () => wikiList };
      },
      contact: "x@example.com",
      sleep: async () => undefined,
      now: () => 0,
    });
    const summary = await backfillCommLinks(client, store, state, () => T0, 3);
    // The sample's meta says page 1 of 205; the loop reads the pages asked for.
    expect(summary.pages).toBe(3);
    expect(summary.added).toBe(2);
    // The wiki lists a record without text on every page read; it is skipped, not an error.
    expect(summary.skipped).toBe(3);
    const item = store.find("comm_link", "21431")!;
    expect(item.url).toBe(
      "https://robertsspaceindustries.com/comm-link/transmission/21431-This-Week-In-Star-Citizen",
    );
    expect(item.published_at).toBe("2026-11-02T20:00:00.000Z");
    expect(saved["21431"]?.wiki).toBe(true);
    expect(
      entryFromRecord({
        ...JSON.parse(wikiList).data[0],
        rsi_url:
          "https://robertsspaceindustries.com/en/comm-link/transmission/1-X",
      }).path,
    ).toBe("/comm-link/transmission/1-X");
  });
});

describe("cleanWikiText", () => {
  it("drops the wiki's bare heading tokens and the repeated title, and nothing else", () => {
    const list = JSON.parse(wikiList) as {
      data: { id: number; title: string; translations: { en_EN: string } }[];
    };
    const jumpPoint = list.data.find((d) => d.id === 21427)!;
    const body = cleanWikiText(jumpPoint.translations.en_EN, jumpPoint.title);
    expect(body.startsWith("ISSUE: 14 05")).toBe(true);
    expect(body).not.toMatch(/\bh[23]\b/);
    expect(cleanWikiText("Title\nBody.", "Title")).toBe("Body.");
    expect(cleanWikiText("h2 Heading\nText h2 kept inline.", "Other")).toBe(
      "Heading\nText h2 kept inline.",
    );
    // An upload's file name where a video stood goes; a hyphenated phrase stays.
    expect(
      cleanWikiText(
        "VEH2618_MK5Trailer_FALLBACK_H264_1920x860_261014 RSI Constellation Mk V Centaurus | Star Citizen\nThe next-generation-iteration-combination, is here.",
        "RSI Constellation Mk V Centaurus | Star Citizen",
      ),
    ).toBe("The next-generation-iteration-combination, is here.");
    expect(
      cleanWikiText("Heap-Thumbnail_Day_Of_The_Vara Day of the Vara", "X"),
    ).toBe("Day of the Vara");
    expect(
      cleanWikiText(
        "SC_DigitalGoodiesPackTopBannerOverlay2 Star_Citizen_21_9_TOP_-BANNER_Overlay Digital goodies pack",
        "X",
      ),
    ).toBe("Digital goodies pack");
    expect(cleanWikiText("Paladin-Banner-Thumbnail Anvil Paladin", "X")).toBe(
      "Anvil Paladin",
    );
    expect(cleanWikiText("ArtemisBannerAdvanced Artemis", "X")).toBe("Artemis");
    expect(cleanWikiText("Nini_StarDust_EverBloom Nini", "X")).toBe("Nini");
    expect(cleanWikiText("InterSec Defense Solutions", "X")).toBe(
      "InterSec Defense Solutions",
    );
    expect(cleanWikiText("Jump-Point issue", "X")).toBe("Jump-Point issue");
    expect(cleanWikiText("Free_fly weekend", "X")).toBe("Free_fly weekend");
  });
});
