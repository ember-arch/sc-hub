import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { MediaManifest } from "schema";
import { describe, expect, it } from "vitest";
import {
  assertOnlyCoversAdded,
  commLinksOnRecord,
  coverCandidates,
  manifestCounts,
  mergeCoverSources,
  mergeCovers,
  publishCovers,
  type CoverPublishDeps,
  type CoverPublishOptions,
} from "../media/cover-publish.js";
import type { EncodedRendition } from "../media/cover-renditions.js";
import { MANIFEST_KEY, hashedPath } from "../media/publish-plan.js";
import { COMM_LINK_HUB_URL, type CoverSource } from "../media/sources.js";
import { type FakeStore, fakeStore } from "./fake-media-store.js";

// ADR-048: CI publishes the covers of new Comm-Links by merging them into the live manifest, and
// changes nothing else in it. The hub page is the committed sample; the store is in memory; RSI and
// the CDN are a fake fetch. No network.

const hub = readFileSync(
  new URL(
    "../../fixtures/news/samples/comm-link-hub.sample.html",
    import.meta.url,
  ),
  "utf8",
);
/** On the sample's first page: 21445 and 21434 are listed, 99999 is not. */
const COVER_21445 =
  "https://media.robertsspaceindustries.com/47458res1wwdv/channel_item_full.jpg";

const NOW = Date.parse("2026-11-11T16:00:00.000Z");
const day = 24 * 60 * 60 * 1000;
const at = (daysAgo: number): string =>
  new Date(NOW - daysAgo * day).toISOString();

const row = (
  id: string,
  publishedAt: string,
  extra: Partial<{ revision: number; takedown: boolean; source: string }> = {},
) => ({
  id: `comm_link:${id}`,
  source: extra.source ?? "comm_link",
  external_id: id,
  url: `https://robertsspaceindustries.com/comm-link/transmission/${id}-X`,
  title: `Comm-Link ${id}`,
  published_at: publishedAt,
  revision: extra.revision ?? 1,
  takedown: extra.takedown ?? false,
});

const existingCover = (id: string) => ({
  external_id: id,
  source: "rsi_comm_link_hub" as const,
  page_url: `https://robertsspaceindustries.com/comm-link/transmission/${id}-X`,
  image_url:
    "https://media.robertsspaceindustries.com/old/channel_item_full.jpg",
  fetched_at: "2026-11-10T20:22:00.543Z",
  renditions: [
    {
      src: `/media/covers/${id}-960-aaaaaaaaaaaa.webp`,
      width: 960,
      height: 515,
    },
  ],
});

/** A live manifest with something in every list the site builds from, as the store holds it. */
const liveManifest = {
  generated_at: "2026-11-11T15:23:27.073Z",
  ships: [
    {
      class_name: "AEGS_Gladius",
      source: "rsi_ship_matrix",
      page_url:
        "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      image_url:
        "https://media.robertsspaceindustries.com/x/wallpaper_1920x1080.jpg",
      fetched_at: "2026-11-08T05:59:56.134Z",
      renditions: [
        {
          src: "/media/ships/aegs_gladius-640-bbbbbbbbbbbb.webp",
          width: 640,
          height: 360,
        },
      ],
    },
  ],
  makers: [
    {
      manufacturer_code: "AEGS",
      source: "fankit",
      fankit_version: "2025_11_19",
      on_light: {
        src: "/media/makers/aegs-on-light-cccccccccccc.webp",
        width: 395,
        height: 128,
      },
      on_dark: null,
    },
  ],
  showcase: [],
  holo: [
    {
      slug: "gladius",
      src: "/media/holo/p05ngl04o8ezx-dddddddddddd.glb",
      bytes: 1234,
      page: "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      size: [10, 4, 20],
      vertices: 100,
      triangles: 200,
    },
  ],
  holo_figure: {
    src: "/media/holo/figure-eeeeeeeeeeee.glb",
    bytes: 100,
    height: 1.8,
  },
  titles: [
    {
      file: "Title_X.png",
      width: 70,
      height: 70,
      renditions: [
        {
          src: "/media/titles/title-x-png-128-ffffffffffff.webp",
          width: 128,
          height: 128,
        },
      ],
    },
  ],
  concepts: [],
  covers: [existingCover("21447")],
  spectrum: [],
};
const liveText = `${JSON.stringify(liveManifest, null, 2)}\n`;
MediaManifest.parse(liveManifest);

/** Stands in for sharp: two widths, bytes derived from the input so keys follow the picture. */
const encode = async (input: Buffer): Promise<EncodedRendition[]> => [
  { width: 960, height: 515, data: Buffer.from(`960:${input.toString()}`) },
  { width: 480, height: 257, data: Buffer.from(`480:${input.toString()}`) },
];
const keyFor = (id: string, width: number, input: string): string =>
  hashedPath(
    `/media/covers/${id}-${width}.webp`,
    createHash("sha256").update(`${width}:${input}`).digest("hex"),
  ).slice(1);

interface Call {
  readonly url: string;
  readonly userAgent: string | null;
  readonly at: number;
}

function harness(
  options: {
    news?: unknown[];
    store?: FakeStore | null;
    hubPage1?: string;
    coverSources?: CoverSource[];
  } = {},
) {
  let clock = NOW;
  const sleeps: number[] = [];
  const calls: Call[] = [];
  const store =
    options.store === undefined
      ? fakeStore([
          { key: MANIFEST_KEY, body: new TextEncoder().encode(liveText) },
        ])
      : options.store;
  const cdnBaseUrl = "https://store.public.blob.vercel-storage.com";
  const fakeFetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, userAgent: headers.get("user-agent"), at: clock });
    if (url === `${cdnBaseUrl}/${MANIFEST_KEY}`) {
      const body =
        store === null
          ? new TextEncoder().encode(liveText)
          : store.objects.get(MANIFEST_KEY)!;
      return new Response(new Uint8Array(body), { status: 200 });
    }
    if (url === COMM_LINK_HUB_URL) {
      return new Response(options.hubPage1 ?? hub, { status: 200 });
    }
    if (url.startsWith(`${COMM_LINK_HUB_URL}?page=`)) {
      return new Response("<html><body>no blocks</body></html>", {
        status: 200,
      });
    }
    if (url.startsWith("https://media.robertsspaceindustries.com/")) {
      return new Response(`jpeg of ${url}`, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  const deps: CoverPublishDeps = {
    fetch: fakeFetch,
    store: store === null ? null : store.store,
    cdnBaseUrl,
    encode,
    userAgent: () =>
      "Coppercork/test (+https://coppercork.com/about; ventures@coppercork.com)",
    now: () => clock,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    newsRows: options.news ?? [
      row("21445", at(1)),
      row("21447", at(2)),
      row("99999", at(3)),
      row("21434", at(30)),
    ],
    coverSources: options.coverSources ?? [],
  };
  const run = (extra: Partial<CoverPublishOptions> = {}) =>
    publishCovers(deps, {
      dryRun: false,
      pages: 3,
      recentDays: 14,
      cdnWaitMs: 60_000,
      cdnPollMs: 10_000,
      ...extra,
    });
  const storedManifest = (): Record<string, unknown> =>
    JSON.parse(
      new TextDecoder().decode(store!.objects.get(MANIFEST_KEY)!),
    ) as Record<string, unknown>;
  return { run, calls, sleeps, store, storedManifest };
}

describe("which Comm-Links get looked for", () => {
  it("takes the latest revision of each Comm-Link and leaves out takedowns and other sources", () => {
    const record = commLinksOnRecord([
      row("1", at(1), { revision: 1 }),
      {
        ...row("1", at(1), { revision: 2 }),
        url: "https://robertsspaceindustries.com/comm-link/transmission/1-New",
      },
      row("2", at(1), { takedown: true }),
      row("3", at(1), { source: "roadmap" }),
    ]);
    expect([...record.keys()]).toEqual(["1"]);
    expect(record.get("1")?.url).toMatch(/1-New$/);
  });

  it("looks only for recent ones without a cover, newest first", () => {
    const record = commLinksOnRecord([
      row("10", at(13)),
      row("11", at(1)),
      row("12", at(20)),
      row("13", at(0.5)),
    ]);
    expect(coverCandidates(record, new Set(["11"]), NOW, 14)).toEqual([
      "13",
      "10",
    ]);
  });
});

describe("merging covers into the live manifest", () => {
  const addition = {
    ...existingCover("21445"),
    renditions: [
      {
        src: "/media/covers/21445-960-123456789abc.webp",
        width: 960,
        height: 515,
      },
    ],
  };

  it("adds the cover, newest id first, sets generated_at and leaves every other entry as it was", () => {
    const { text, manifest } = mergeCovers(
      liveText,
      [addition],
      "2026-11-11T16:00:00.000Z",
    );
    const merged = JSON.parse(text) as typeof liveManifest;
    expect(merged.covers.map((c) => c.external_id)).toEqual(["21447", "21445"]);
    expect(merged.generated_at).toBe("2026-11-11T16:00:00.000Z");
    for (const key of Object.keys(
      liveManifest,
    ) as (keyof typeof liveManifest)[]) {
      if (key === "covers" || key === "generated_at") continue;
      expect(JSON.stringify(merged[key])).toBe(
        JSON.stringify(liveManifest[key]),
      );
    }
    expect(Object.keys(merged)).toEqual(Object.keys(liveManifest));
    expect(manifestCounts(manifest)).toMatchObject({
      covers: 2,
      ships: 1,
      makers: 1,
      holo: 1,
      titles: 1,
    });
  });

  it("refuses a cover that is already there, and a live manifest of an unknown shape", () => {
    expect(() =>
      mergeCovers(
        liveText,
        [existingCover("21447")],
        "2026-11-11T16:00:00.000Z",
      ),
    ).toThrow(/already in the manifest/);
    expect(() =>
      mergeCovers(
        JSON.stringify({ ...liveManifest, novel: [] }),
        [addition],
        "2026-11-11T16:00:00.000Z",
      ),
    ).toThrow();
  });

  it("catches a merge that would drop or change anything", () => {
    const before = JSON.parse(liveText) as Record<string, unknown>;
    expect(() =>
      assertOnlyCoversAdded(before, { ...before, ships: [] }),
    ).toThrow(/ships/);
    expect(() =>
      assertOnlyCoversAdded(before, { ...before, covers: [] }),
    ).toThrow(/21447/);
    expect(() =>
      assertOnlyCoversAdded(before, { ...before, extra: 1 }),
    ).toThrow(/fields/);
    expect(() =>
      assertOnlyCoversAdded(before, {
        ...before,
        covers: [
          { ...existingCover("21447"), fetched_at: "2026-11-11T00:00:00.000Z" },
        ],
      }),
    ).toThrow(/21447/);
    expect(() =>
      assertOnlyCoversAdded(before, {
        ...before,
        generated_at: "x",
        covers: [existingCover("21447"), addition],
      }),
    ).not.toThrow();
  });

  it("keeps every row of the committed record and adds the new ones", () => {
    const old = { external_id: "21447", file: "21447.jpg" } as CoverSource;
    const fresh = { external_id: "21445", file: "21445.jpg" } as CoverSource;
    expect(mergeCoverSources([old], [fresh]).map((r) => r.external_id)).toEqual(
      ["21447", "21445"],
    );
  });
});

describe("a run", () => {
  it("publishes a new Comm-Link's cover and changes nothing else in the live manifest", async () => {
    const h = harness();
    const result = await h.run();

    expect(result.candidates).toEqual(["21445", "99999"]);
    expect(result.notOnHub).toEqual(["99999"]);
    const input = `jpeg of ${COVER_21445}`;
    const keys = [keyFor("21445", 960, input), keyFor("21445", 480, input)];
    expect(result.planned).toEqual([{ external_id: "21445", keys }]);
    expect(result.uploaded).toBe(2);
    expect(result.manifest).toBe("uploaded");
    expect(result.attempts).toBe(1);

    // The renditions as immutable objects, then the manifest, conditional on what was read.
    expect(h.store!.puts.map((p) => p.key)).toEqual([...keys, MANIFEST_KEY]);
    expect(h.store!.puts[0]).toMatchObject({
      contentType: "image/webp",
      cacheMaxAge: 31536000,
      overwrite: false,
    });
    expect(h.store!.puts[2]).toMatchObject({
      cacheMaxAge: 300,
      ifMatch: '"v1"',
    });

    const stored = h.storedManifest();
    MediaManifest.parse(stored);
    assertOnlyCoversAdded(liveManifest, stored);
    expect(result.before).toEqual({
      ships: 1,
      makers: 1,
      showcase: 0,
      holo: 1,
      titles: 1,
      concepts: 0,
      covers: 1,
      spectrum: 0,
    });
    expect(result.after).toEqual({ ...result.before, covers: 2 });
    const added = (
      stored["covers"] as {
        external_id: string;
        renditions: { src: string }[];
      }[]
    ).find((c) => c.external_id === "21445")!;
    expect(added.renditions.map((r) => r.src.slice(1))).toEqual(keys);

    // The record that lands on main and redeploys the site.
    expect(result.coverSources?.map((r) => r.external_id)).toEqual(["21445"]);
    expect(result.coverSources?.[0]).toMatchObject({
      file: "21445.jpg",
      image_url: COVER_21445,
      content_type: "image/jpeg",
      bytes: Buffer.byteLength(input),
    });
    expect(result.cdn).toMatch(/^current/);
  });

  it("asks RSI one request at a time, 5 s apart, with the User-Agent, and stops at the hub's end", async () => {
    const h = harness();
    await h.run();
    const rsi = h.calls.filter((c) =>
      c.url.includes("robertsspaceindustries.com"),
    );
    expect(rsi.map((c) => c.url)).toEqual([
      COMM_LINK_HUB_URL,
      `${COMM_LINK_HUB_URL}?page=2`,
      COVER_21445,
    ]);
    for (const call of rsi)
      expect(call.userAgent).toMatch(/ventures@coppercork\.com/);
    for (let i = 1; i < rsi.length; i += 1) {
      expect(rsi[i]!.at - rsi[i - 1]!.at).toBeGreaterThanOrEqual(5000);
    }
  });

  it("asks RSI nothing and writes nothing when every recent Comm-Link has its cover", async () => {
    const h = harness({ news: [row("21447", at(1)), row("21434", at(30))] });
    const result = await h.run();
    expect(result.manifest).toBe("nothing to do");
    expect(
      h.calls.filter((c) => c.url.includes("robertsspaceindustries.com")),
    ).toEqual([]);
    expect(h.store!.puts).toEqual([]);
    expect(result.coverSources).toBeNull();
  });

  it("finds nothing to do on a second run", async () => {
    const h = harness();
    await h.run();
    const puts = h.store!.puts.length;
    const again = await h.run();
    expect(again.candidates).toEqual(["99999"]);
    expect(again.manifest).toBe("nothing to do");
    expect(h.store!.puts.length).toBe(puts);
  });

  it("leaves a Comm-Link under takedown alone", async () => {
    const h = harness({ news: [row("21445", at(1), { takedown: true })] });
    expect((await h.run()).candidates).toEqual([]);
  });

  it("uploads nothing and writes no record on a dry run, and still checks the merge", async () => {
    const h = harness();
    const result = await h.run({ dryRun: true });
    expect(result.manifest).toBe("dry run");
    expect(result.after).toEqual({ ...result.before, covers: 2 });
    expect(result.coverSources).toBeNull();
    expect(h.store!.puts).toEqual([]);
  });

  it("dry-runs without credentials by reading the manifest through the CDN", async () => {
    const h = harness({ store: null });
    const result = await h.run({ dryRun: true });
    expect(result.manifest).toBe("dry run");
    expect(result.planned.map((p) => p.external_id)).toEqual(["21445"]);
    expect(h.calls[0]!.url).toBe(
      `https://store.public.blob.vercel-storage.com/${MANIFEST_KEY}`,
    );
  });

  it("reads again and merges again when another writer changes the manifest first", async () => {
    let raced = false;
    const rival = {
      ...liveManifest,
      generated_at: "2026-11-11T15:59:00.000Z",
      covers: [existingCover("21447"), existingCover("21386")],
    };
    const store = fakeStore(
      [{ key: MANIFEST_KEY, body: new TextEncoder().encode(liveText) }],
      {
        beforePut: (key, s) => {
          if (key === MANIFEST_KEY && !raced) {
            raced = true;
            s.set(
              MANIFEST_KEY,
              new TextEncoder().encode(JSON.stringify(rival)),
            );
          }
        },
      },
    );
    const h = harness({ store });
    const result = await h.run();
    expect(result.attempts).toBe(2);
    const covers = (
      h.storedManifest()["covers"] as { external_id: string }[]
    ).map((c) => c.external_id);
    expect(covers).toEqual(["21447", "21445", "21386"]);
  });

  it("adds nothing when the other writer already put the same cover up", async () => {
    let raced = false;
    const rival = {
      ...liveManifest,
      covers: [existingCover("21447"), existingCover("21445")],
    };
    const store = fakeStore(
      [{ key: MANIFEST_KEY, body: new TextEncoder().encode(liveText) }],
      {
        beforePut: (key, s) => {
          if (key === MANIFEST_KEY && !raced) {
            raced = true;
            s.set(
              MANIFEST_KEY,
              new TextEncoder().encode(JSON.stringify(rival)),
            );
          }
        },
      },
    );
    const h = harness({ store });
    const result = await h.run();
    expect(result.manifest).toBe("already there");
    expect(result.coverSources).toBeNull();
    expect(h.storedManifest()).toEqual(rival);
  });

  it("gives up after three lost races rather than overwrite", async () => {
    const store = fakeStore(
      [{ key: MANIFEST_KEY, body: new TextEncoder().encode(liveText) }],
      {
        beforePut: (key, s) => {
          if (key === MANIFEST_KEY)
            s.set(MANIFEST_KEY, new TextEncoder().encode(liveText));
        },
      },
    );
    const h = harness({ store });
    await expect(h.run()).rejects.toThrow(/precondition failed/);
  });

  it("rehearses on a cover that is already up and lands on the same keys, writing nothing", async () => {
    const input = `jpeg of ${COVER_21445}`;
    const up = {
      ...existingCover("21445"),
      renditions: [
        { src: `/${keyFor("21445", 960, input)}`, width: 960, height: 515 },
        { src: `/${keyFor("21445", 480, input)}`, width: 480, height: 257 },
      ],
    };
    const text = JSON.stringify({
      ...liveManifest,
      covers: [up, existingCover("21447")],
    });
    const store = fakeStore([
      { key: MANIFEST_KEY, body: new TextEncoder().encode(text) },
    ]);
    const h = harness({ store });
    const result = await h.run({ rehearse: ["21445"] });
    expect(result.rehearsal).toEqual({ "21445": true });
    expect(result.manifest).toBe("dry run");
    expect(result.before.covers).toBe(1);
    expect(result.after?.covers).toBe(2);
    expect(store.puts).toEqual([]);
  });

  it("halts when the hub's first page lists no transmission", async () => {
    const h = harness({ hubPage1: "<html>a new layout</html>" });
    await expect(h.run()).rejects.toThrow(/first page/);
    expect(h.store!.puts).toEqual([]);
  });

  it("halts on a live manifest it does not know the shape of", async () => {
    const store = fakeStore([
      {
        key: MANIFEST_KEY,
        body: new TextEncoder().encode(
          JSON.stringify({ ...liveManifest, novel: [] }),
        ),
      },
    ]);
    const h = harness({ store });
    await expect(h.run()).rejects.toThrow();
    expect(store.puts).toEqual([]);
  });
});

describe("what the audit of ADR-048 asked for", () => {
  it("waits the RSI spacing before its first request, since the polls just asked RSI", async () => {
    const h = harness();
    await h.run();
    const first = h.calls.find((c) =>
      c.url.includes("robertsspaceindustries.com"),
    )!;
    expect(first.at - NOW).toBeGreaterThanOrEqual(5000);
  });

  it("counts a write whose answer was lost as its own, and still records the cover", async () => {
    let lost = false;
    const store = fakeStore(
      [{ key: MANIFEST_KEY, body: new TextEncoder().encode(liveText) }],
      {
        landThenRefuse: (key) => {
          if (key !== MANIFEST_KEY || lost) return false;
          lost = true;
          return true;
        },
      },
    );
    const h = harness({ store });
    const result = await h.run();
    expect(result.attempts).toBe(2);
    expect(result.manifest).toBe("uploaded");
    expect(result.coverSources?.map((r) => r.external_id)).toEqual(["21445"]);
    expect(result.generatedAt).toBe(h.storedManifest()["generated_at"]);
  });

  it("waits at least a minute after the write before it ends, so every edge has the new manifest", async () => {
    const h = harness();
    await h.run();
    const write = h.store!.puts.findIndex((p) => p.key === MANIFEST_KEY);
    expect(write).toBeGreaterThan(-1);
    expect(h.sleeps.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(60_000);
  });

  it("rehearses a Comm-Link older than the window", async () => {
    const h = harness({ news: [row("21445", at(40))] });
    const result = await h.run({ rehearse: ["21445"] });
    expect(result.candidates).toEqual(["21445"]);
    expect(result.manifest).toBe("dry run");
  });
});
