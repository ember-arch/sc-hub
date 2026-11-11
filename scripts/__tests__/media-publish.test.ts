import type { MediaManifest } from "schema";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { MediaStore } from "../media/blob.js";
import { fakeStore } from "./fake-media-store.js";
import {
  classifyBlobError,
  isAlreadyThere,
  sameEtag,
  storeBaseUrl,
} from "../media/blob.js";
import {
  IMMUTABLE_MAX_AGE,
  MANIFEST_KEY,
  MANIFEST_MAX_AGE,
  contentTypeOf,
  hashedPath,
  mediaPathsIn,
  planPublish,
  rewriteMediaPaths,
} from "../media/publish-plan.js";
import {
  droppedCovers,
  manifestBody,
  syncToStore,
  withRetries,
} from "../media/publish-sync.js";

// ADR-034: the media go to the store under content-addressed keys, the manifest is rewritten to
// name them and goes up last, and a run uploads only what the store lacks. No network: the sync
// runs against an in-memory store.

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const hashC = "0123456789abcdef".repeat(4);

const manifest: MediaManifest = {
  generated_at: "2026-11-10T06:00:00.000Z",
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
          src: "/media/ships/aegs_gladius-1920.webp",
          width: 1920,
          height: 1080,
        },
        { src: "/media/ships/aegs_gladius-640.webp", width: 640, height: 360 },
      ],
    },
  ],
  makers: [
    {
      manufacturer_code: "AEGS",
      source: "fankit",
      fankit_version: "2025_11_19",
      on_light: {
        src: "/media/makers/aegs-on-light.webp",
        width: 395,
        height: 128,
      },
      on_dark: null,
    },
  ],
  showcase: [
    {
      slug: "odin",
      article: null,
      wiki_article: null,
      images: [
        {
          key: "cover",
          renditions: [
            {
              src: "/media/showcase/odin/cover-1600.webp",
              width: 1600,
              height: 900,
            },
          ],
          has_alpha: false,
        },
      ],
      videos: [
        {
          key: "video-1",
          src: "/media/showcase/odin/video-1.mp4",
          poster: "cover",
          width: 1920,
          height: 1080,
        },
      ],
      model: null,
      roles: { background: "cover" },
      chapters: [],
      gallery: ["cover"],
      schematics: [],
      figures: [],
    },
  ],
  holo: [
    {
      slug: "gladius",
      src: "/media/holo/p05ngl04o8ezx.glb",
      bytes: 1234,
      page: "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      size: [10, 4, 20],
      vertices: 100,
      triangles: 200,
    },
  ],
  holo_figure: { src: "/media/holo/figure.glb", bytes: 100, height: 1.8 },
  titles: [
    {
      file: "Title_X.png",
      width: 70,
      height: 70,
      renditions: [
        { src: "/media/titles/title-x-png-128.webp", width: 128, height: 128 },
      ],
    },
  ],
  concepts: [],
  covers: [],
  spectrum: [],
};

const paths = mediaPathsIn(manifest);

/** Bytes whose SHA-256 is what the plan expects: the plan is built from these same bytes. */
const bytesOf = new Map<string, Uint8Array>(
  paths.map((src, i) => [src, new TextEncoder().encode(`file ${i} ${src}`)]),
);
const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");
const files = paths.map((src) => ({
  src,
  sha256: sha256(bytesOf.get(src)!),
  bytes: bytesOf.get(src)!.byteLength,
}));

describe("content-addressed keys", () => {
  it("puts the first twelve hex of the hash before the extension, with a dash", () => {
    expect(hashedPath("/media/ships/aegs_gladius-1280.webp", hashC)).toBe(
      "/media/ships/aegs_gladius-1280-0123456789ab.webp",
    );
    expect(hashedPath("/media/holo/p05ngl04o8ezx.glb", hashA)).toBe(
      "/media/holo/p05ngl04o8ezx-aaaaaaaaaaaa.glb",
    );
    expect(() => hashedPath("/media/noext", hashA)).toThrow(/extension/);
    expect(() => hashedPath("/media/a.webp", "nope")).toThrow(/SHA-256/);
  });

  it("knows the content types the media folder holds and refuses a new one", () => {
    expect(contentTypeOf("/media/a.webp")).toBe("image/webp");
    expect(contentTypeOf("/media/holo/a.glb")).toBe("model/gltf-binary");
    expect(contentTypeOf("/media/showcase/odin/v.mp4")).toBe("video/mp4");
    expect(contentTypeOf("/media/manifest.json")).toBe("application/json");
    expect(() => contentTypeOf("/media/a.exe")).toThrow(/content type/);
  });

  it("finds every /media/ path in a manifest once, and nothing else", () => {
    expect(paths).toEqual([
      "/media/ships/aegs_gladius-1920.webp",
      "/media/ships/aegs_gladius-640.webp",
      "/media/makers/aegs-on-light.webp",
      "/media/showcase/odin/cover-1600.webp",
      "/media/showcase/odin/video-1.mp4",
      "/media/holo/p05ngl04o8ezx.glb",
      "/media/holo/figure.glb",
      "/media/titles/title-x-png-128.webp",
    ]);
  });

  it("rewrites only /media/ strings, leaving page URLs, keys and numbers", () => {
    const out = rewriteMediaPaths(manifest, (src) => `X${src}`);
    expect(out.ships[0]!.renditions[0]!.src).toBe(
      "X/media/ships/aegs_gladius-1920.webp",
    );
    expect(out.ships[0]!.page_url).toBe(manifest.ships[0]!.page_url);
    expect(out.showcase[0]!.roles).toEqual({ background: "cover" });
    expect(out.showcase[0]!.videos[0]!.poster).toBe("cover");
    expect(out.holo[0]!.size).toEqual([10, 4, 20]);
    expect(out.holo_figure!.src).toBe("X/media/holo/figure.glb");
  });
});

describe("the publish plan", () => {
  it("plans one year-cached object per referenced file and a manifest that names the new keys", () => {
    const plan = planPublish(manifest, [
      ...files,
      { src: "/media/manifest.json", sha256: hashA, bytes: 10 },
      { src: "/media/ships/stray.webp", sha256: hashB, bytes: 10 },
    ]);
    expect(plan.objects).toHaveLength(paths.length);
    const first = files[0]!;
    expect(plan.objects[0]).toEqual({
      key: `media/ships/aegs_gladius-1920-${first.sha256.slice(0, 12)}.webp`,
      src: "/media/ships/aegs_gladius-1920.webp",
      bytes: first.bytes,
      sha256: first.sha256,
      contentType: "image/webp",
      cacheMaxAge: IMMUTABLE_MAX_AGE,
    });
    expect(plan.manifest.ships[0]!.renditions[0]!.src).toBe(
      `/${plan.objects[0]!.key}`,
    );
    expect(plan.manifest.holo[0]!.src).toMatch(
      /^\/media\/holo\/p05ngl04o8ezx-[0-9a-f]{12}\.glb$/,
    );
    expect(plan.manifest.showcase[0]!.videos[0]!.src).toMatch(
      /^\/media\/showcase\/odin\/video-1-[0-9a-f]{12}\.mp4$/,
    );
    expect(plan.manifest.titles[0]!.renditions[0]!.src).toMatch(
      /^\/media\/titles\/title-x-png-128-[0-9a-f]{12}\.webp$/,
    );
    expect(plan.manifest.ships[0]!.page_url).toBe(manifest.ships[0]!.page_url);
    expect(plan.manifest.generated_at).toBe(manifest.generated_at);
    // The manifest itself is not an orphan; a file the manifest does not name is reported, not sent.
    expect(plan.unreferenced).toEqual(["/media/ships/stray.webp"]);
    expect(plan.objects.map((o) => o.src)).not.toContain(
      "/media/ships/stray.webp",
    );
  });

  it("refuses a manifest that names a file not on disk", () => {
    expect(() => planPublish(manifest, files.slice(1))).toThrow(
      /1 file\(s\) not on disk: \/media\/ships\/aegs_gladius-1920.webp/,
    );
  });
});

/** An in-memory store that records what was asked of it. */
const plan = planPublish(manifest, files);
const readFile = (src: string): Uint8Array => bytesOf.get(src)!;
const sync = (
  store: MediaStore,
  extra: Partial<Parameters<typeof syncToStore>[2]> = {},
) =>
  syncToStore(plan, store, {
    dryRun: false,
    prune: false,
    concurrency: 3,
    readFile,
    ...extra,
  });

describe("bringing the store into line", () => {
  it("uploads every object with its type and a year's cache, then the manifest with five minutes", async () => {
    const fake = fakeStore();
    const result = await sync(fake.store);
    expect(result.uploaded).toBe(paths.length);
    expect(result.alreadyThere).toBe(0);
    expect(result.manifest).toBe("uploaded");
    expect(fake.puts.at(-1)).toEqual({
      key: MANIFEST_KEY,
      contentType: "application/json",
      cacheMaxAge: MANIFEST_MAX_AGE,
      overwrite: true,
    });
    const glb = fake.puts.find((p) => p.key.endsWith(".glb"));
    expect(glb).toMatchObject({
      contentType: "model/gltf-binary",
      cacheMaxAge: IMMUTABLE_MAX_AGE,
      overwrite: false,
    });
    expect(fake.objects.get(MANIFEST_KEY)).toEqual(manifestBody(plan));
    expect(result.storeBaseUrl).toBe(fake.base);
    expect(result.sampleKey).toBe(plan.objects[0]!.key);
  });

  it("uploads only what the store lacks, and finds the manifest unchanged on a repeat", async () => {
    const fake = fakeStore();
    await sync(fake.store);
    const before = fake.puts.length;
    const again = await sync(fake.store);
    expect(again.uploaded).toBe(0);
    expect(again.alreadyThere).toBe(paths.length);
    expect(again.manifest).toBe("unchanged");
    expect(fake.puts.length).toBe(before);
  });

  it("replaces a half-written object whose size differs, and nothing else", async () => {
    const full = fakeStore();
    await sync(full.store);
    const victim = plan.objects[2]!;
    const fake = fakeStore(
      [...full.objects.entries()]
        .filter(([k]) => k !== MANIFEST_KEY)
        .map(([key, body]) => ({
          key,
          body: key === victim.key ? body.slice(0, 1) : body,
        })),
    );
    const result = await sync(fake.store);
    expect(result.uploaded).toBe(1);
    expect(fake.puts.map((p) => p.key)).toEqual([victim.key, MANIFEST_KEY]);
    expect(fake.puts[0]!.overwrite).toBe(true);
  });

  it("refuses to fill a key with bytes that differ from the ones it was planned for", async () => {
    const fake = fakeStore();
    await expect(
      sync(fake.store, {
        readFile: (src) =>
          src === paths[1]
            ? new TextEncoder().encode("changed")
            : readFile(src),
      }),
    ).rejects.toThrow(/changed on disk/);
    expect(fake.objects.has(MANIFEST_KEY)).toBe(false);
  });

  it("counts orphans, and prunes them only when the manifest did not change this run", async () => {
    const fake = fakeStore([
      {
        key: "media/ships/old-640-000000000000.webp",
        body: new Uint8Array(3),
      },
    ]);
    const first = await sync(fake.store, { prune: true });
    expect(first.orphans).toBe(1);
    expect(first.pruned).toBe(0);
    expect(first.pruneNote).toMatch(/manifest changed this run/);
    expect(fake.deletes).toEqual([]);
    const second = await sync(fake.store, { prune: true });
    expect(second.manifest).toBe("unchanged");
    expect(second.pruned).toBe(1);
    expect(fake.deletes).toEqual(["media/ships/old-640-000000000000.webp"]);
    expect(fake.objects.has(MANIFEST_KEY)).toBe(true);
  });

  it("uploads nothing on a dry run and still reports the plan", async () => {
    const fake = fakeStore();
    const result = await sync(fake.store, { dryRun: true, prune: true });
    expect(result.manifest).toBe("dry run");
    expect(result.alreadyThere).toBe(0);
    expect(fake.puts).toEqual([]);
    expect(fake.objects.size).toBe(0);
  });
});

// ADR-048: the News workflow adds covers to the live manifest, so the hand publish reads it first,
// refuses to drop covers it lacks, and writes only over the manifest it read.
describe("sharing the manifest with the CI cover step", () => {
  const cover = (id: string) => ({
    external_id: id,
    source: "rsi_comm_link_hub",
    page_url: `https://robertsspaceindustries.com/comm-link/transmission/${id}-X`,
    image_url:
      "https://media.robertsspaceindustries.com/x/channel_item_full.jpg",
    fetched_at: "2026-11-11T15:20:17.797Z",
    renditions: [
      {
        src: `/media/covers/${id}-480-0123456789ab.webp`,
        width: 480,
        height: 257,
      },
    ],
  });
  const liveWith = (ids: string[]) =>
    new TextEncoder().encode(
      JSON.stringify({ ...plan.manifest, covers: ids.map(cover) }),
    );

  it("finds the covers a new manifest would drop", () => {
    expect(
      droppedCovers(liveWith(["20943", "21445"]), { covers: [cover("21445")] }),
    ).toEqual(["20943"]);
    expect(droppedCovers(liveWith([]), { covers: [] })).toEqual([]);
  });

  it("refuses, before uploading anything, a manifest without a cover the live one has", async () => {
    const fake = fakeStore([{ key: MANIFEST_KEY, body: liveWith(["20943"]) }]);
    await expect(sync(fake.store)).rejects.toThrow(
      /1 cover\(s\) this one lacks \(20943\).*fetch-covers\.ts and prepare\.ts/,
    );
    expect(fake.puts).toEqual([]);
  });

  it("drops them only when asked, and says which", async () => {
    const fake = fakeStore([{ key: MANIFEST_KEY, body: liveWith(["20943"]) }]);
    const result = await sync(fake.store, { allowCoverDrop: true });
    expect(result.manifest).toBe("uploaded");
    expect(result.droppedCovers).toEqual(["20943"]);
  });

  it("writes the manifest only over the one it read", async () => {
    const rival = new TextEncoder().encode('{"rival":true}');
    let raced = false;
    const fake = fakeStore([{ key: MANIFEST_KEY, body: liveWith([]) }], {
      beforePut: (key, store) => {
        if (key === MANIFEST_KEY && !raced) {
          raced = true;
          store.set(MANIFEST_KEY, rival);
        }
      },
    });
    await expect(sync(fake.store)).rejects.toThrow(
      /changed while this publish ran.*nothing was overwritten/,
    );
    expect(fake.objects.get(MANIFEST_KEY)).toEqual(rival);
    expect(fake.puts.at(-1)?.key).not.toBe(MANIFEST_KEY);
  });

  it("names the ETag it read on the manifest's write", async () => {
    const fake = fakeStore([{ key: MANIFEST_KEY, body: liveWith([]) }]);
    await sync(fake.store);
    expect(fake.puts.at(-1)).toMatchObject({
      key: MANIFEST_KEY,
      ifMatch: '"v1"',
    });
  });
});

describe("retries", () => {
  const noWait = async () => {};
  const failing = (statuses: (number | null)[]) => {
    let n = 0;
    return async () => {
      const status = statuses[n];
      n += 1;
      if (status === undefined) return "ok";
      throw status === null
        ? new Error("socket hang up")
        : Object.assign(new Error(`HTTP ${status}`), { status });
    };
  };

  it("retries network errors, 5xx, 408 and 429, then gives up", async () => {
    expect(
      await withRetries(
        "x",
        failing([null, 503, 408, 429]),
        () => {},
        5,
        noWait,
      ),
    ).toBe("ok");
    await expect(
      withRetries("x", failing([500, 500, 500, 500]), () => {}, 4, noWait),
    ).rejects.toThrow(/HTTP 500/);
  });

  it("stops at once on a refusal", async () => {
    const calls: number[] = [];
    const attempt = failing([403]);
    await expect(
      withRetries(
        "x",
        async () => {
          calls.push(1);
          return attempt();
        },
        () => {},
        4,
        noWait,
      ),
    ).rejects.toThrow(/HTTP 403/);
    expect(calls).toHaveLength(1);
  });
});

describe("the store's ETags", () => {
  it("match across the weak marker compression adds, and only then", () => {
    expect(sameEtag('"abc"', 'W/"abc"')).toBe(true);
    expect(sameEtag('W/"abc"', '"abc"')).toBe(true);
    expect(sameEtag('"abc"', '"abd"')).toBe(false);
  });
});

describe("the store's base address", () => {
  it("is the object's URL without its key", () => {
    expect(
      storeBaseUrl(
        "https://abc.public.blob.vercel-storage.com/media/ships/a.webp",
        "media/ships/a.webp",
      ),
    ).toBe("https://abc.public.blob.vercel-storage.com");
    expect(() => storeBaseUrl("https://x/y", "media/a.webp")).toThrow(
      /end with/,
    );
  });
});

describe("the store's errors, as the retry logic reads them", () => {
  it("marks a refusal with a 4xx, rate limiting with 429 and the store's wait, and leaves the rest", async () => {
    const blob = await import("@vercel/blob");
    const status = (error: unknown) => (error as { status?: number }).status;
    expect(status(classifyBlobError(new blob.BlobAccessError()))).toBe(403);
    expect(status(classifyBlobError(new blob.BlobStoreNotFoundError()))).toBe(
      404,
    );
    expect(
      status(classifyBlobError(new blob.BlobContentTypeNotAllowedError("x"))),
    ).toBe(400);
    // A lost conditional write (ADR-048) is read again by the caller, never retried blind.
    expect(
      status(classifyBlobError(new blob.BlobPreconditionFailedError())),
    ).toBe(412);
    expect(status(classifyBlobError(new blob.BlobUnknownError()))).toBe(400);
    const limited = classifyBlobError(new blob.BlobServiceRateLimited(7)) as {
      status?: number;
      retryAfter?: number;
    };
    expect(limited.status).toBe(429);
    expect(limited.retryAfter).toBe(7);
    const taken = new blob.BlobError(
      "This blob already exists, use `allowOverwrite: true` if you want to overwrite it.",
    );
    expect(status(classifyBlobError(taken))).toBe(400);
    expect(isAlreadyThere(taken)).toBe(true);
    expect(isAlreadyThere(new blob.BlobAccessError())).toBe(false);
    const network = new TypeError("fetch failed");
    expect(classifyBlobError(network)).toBe(network);
    expect(
      status(classifyBlobError(new blob.BlobServiceNotAvailable())),
    ).toBeUndefined();
  });

  it("waits the store's own time on rate limiting", async () => {
    const waits: number[] = [];
    let n = 0;
    const result = await withRetries(
      "x",
      async () => {
        n += 1;
        if (n === 1)
          throw Object.assign(new Error("slow down"), {
            status: 429,
            retryAfter: 3,
          });
        return "ok";
      },
      () => {},
      3,
      async (ms) => {
        waits.push(ms);
      },
    );
    expect(result).toBe("ok");
    expect(waits).toEqual([3000]);
  });
});
