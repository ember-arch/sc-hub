import type { MediaManifest } from "schema";
import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_CACHE,
  contentTypeOf,
  hashedPath,
  mediaPathsIn,
  planPublish,
  rewriteMediaPaths,
} from "../media/publish-plan.js";
import {
  R2Client,
  R2Error,
  corsXml,
  encodeRfc3986,
  parseListing,
  sha256Hex,
  signRequest,
} from "../media/r2.js";

// ADR-034: the media go to the bucket under content-addressed keys, the manifest is rewritten to
// name them, and the client signs like S3. No network: the client takes a fetch of its own.

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
};

const paths = mediaPathsIn(manifest);
const files = paths.map((src, i) => ({
  src,
  sha256: [hashA, hashB, hashC][i % 3]!,
  bytes: 1000 + i,
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
  it("plans one immutable object per referenced file and a manifest that names the new keys", () => {
    const plan = planPublish(manifest, [
      ...files,
      { src: "/media/manifest.json", sha256: hashA, bytes: 10 },
      { src: "/media/ships/stray.webp", sha256: hashB, bytes: 10 },
    ]);
    expect(plan.objects).toHaveLength(paths.length);
    expect(plan.objects[0]).toEqual({
      key: "media/ships/aegs_gladius-1920-aaaaaaaaaaaa.webp",
      src: "/media/ships/aegs_gladius-1920.webp",
      bytes: 1000,
      contentType: "image/webp",
      cacheControl: IMMUTABLE_CACHE,
    });
    expect(plan.manifest.ships[0]!.renditions[0]!.src).toBe(
      "/media/ships/aegs_gladius-1920-aaaaaaaaaaaa.webp",
    );
    expect(plan.manifest.ships[0]!.renditions[1]!.src).toBe(
      "/media/ships/aegs_gladius-640-bbbbbbbbbbbb.webp",
    );
    expect(plan.manifest.holo[0]!.src).toBe(
      "/media/holo/p05ngl04o8ezx-0123456789ab.glb",
    );
    expect(plan.manifest.showcase[0]!.videos[0]!.src).toBe(
      "/media/showcase/odin/video-1-bbbbbbbbbbbb.mp4",
    );
    expect(plan.manifest.titles[0]!.renditions[0]!.src).toBe(
      "/media/titles/title-x-png-128-bbbbbbbbbbbb.webp",
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

describe("Signature Version 4", () => {
  it("reproduces the get-vanilla vector of AWS's test suite", () => {
    const signed = signRequest({
      method: "GET",
      url: new URL("https://example.amazonaws.com/"),
      headers: {},
      payloadHash: sha256Hex(""),
      now: new Date("2015-08-30T12:36:00Z"),
      accessKeyId: "AKIDEXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
      region: "us-east-1",
      service: "service",
    });
    expect(signed["x-amz-date"]).toBe("20150830T123600Z");
    expect(signed["authorization"]).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });

  it("encodes the five characters encodeURIComponent leaves", () => {
    expect(encodeRfc3986("a b!'()*~")).toBe("a%20b%21%27%28%29%2A~");
  });
});

describe("the R2 client", () => {
  const credentials = {
    accountId: "acct",
    accessKeyId: "AKID",
    secretAccessKey: "secret",
    bucket: "sc-hub-media",
  };
  const clock = () => new Date("2026-01-01T00:00:00Z");

  it("puts an object with its content type, cache header and signature, and no Host of its own", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (
      url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response("", { status: 200 });
    }) as typeof fetch;
    const client = new R2Client(credentials, fetchImpl, clock);
    const body = new TextEncoder().encode("RIFF");
    await client.put("media/ships/a-640-aaaaaaaaaaaa.webp", body, {
      contentType: "image/webp",
      cacheControl: IMMUTABLE_CACHE,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(
      "https://acct.r2.cloudflarestorage.com/sc-hub-media/media/ships/a-640-aaaaaaaaaaaa.webp",
    );
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(calls[0]!.init.method).toBe("PUT");
    expect(headers["content-type"]).toBe("image/webp");
    expect(headers["cache-control"]).toBe(IMMUTABLE_CACHE);
    expect(headers["x-amz-content-sha256"]).toBe(sha256Hex(body));
    expect(headers["x-amz-date"]).toBe("20260101T000000Z");
    expect(headers["host"]).toBeUndefined();
    expect(headers["authorization"]).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKID\/20260101\/auto\/s3\/aws4_request, SignedHeaders=cache-control;content-type;host;x-amz-content-sha256;x-amz-date, Signature=[0-9a-f]{64}$/,
    );
  });

  it("lists every page of the bucket, following the continuation token", async () => {
    const urls: string[] = [];
    const pages = [
      `<ListBucketResult><IsTruncated>true</IsTruncated><NextContinuationToken>tok&amp;1</NextContinuationToken><Contents><Key>media/a.webp</Key><Size>10</Size><ETag>"abc"</ETag></Contents><Contents><Key>media/b.webp</Key><Size>20</Size><ETag>"def"</ETag></Contents></ListBucketResult>`,
      `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>media/manifest.json</Key><Size>5</Size><ETag>"m"</ETag></Contents></ListBucketResult>`,
    ];
    const fetchImpl = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(pages.shift() ?? "", { status: 200 });
    }) as typeof fetch;
    const client = new R2Client(credentials, fetchImpl, clock);
    const listed = await client.list("media/");
    expect([...listed.keys()]).toEqual([
      "media/a.webp",
      "media/b.webp",
      "media/manifest.json",
    ]);
    expect(listed.get("media/b.webp")).toEqual({
      key: "media/b.webp",
      size: 20,
      etag: "def",
    });
    expect(urls).toHaveLength(2);
    expect(urls[0]).toBe(
      "https://acct.r2.cloudflarestorage.com/sc-hub-media?list-type=2&prefix=media%2F&max-keys=1000",
    );
    expect(new URL(urls[1]!).searchParams.get("continuation-token")).toBe(
      "tok&1",
    );
  });

  it("parses an empty listing", () => {
    expect(
      parseListing(
        "<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>",
      ),
    ).toEqual({ objects: [], next: null });
  });

  it("surfaces a refusal with its status", async () => {
    const fetchImpl = (async () =>
      new Response("<Error><Code>AccessDenied</Code></Error>", {
        status: 403,
      })) as typeof fetch;
    const client = new R2Client(credentials, fetchImpl, clock);
    await expect(client.putCors()).rejects.toMatchObject({
      name: "R2Error",
      status: 403,
      operation: "PutBucketCors",
    });
    await expect(client.putCors()).rejects.toBeInstanceOf(R2Error);
  });

  it("writes the CORS rule the holoviewer needs", () => {
    expect(corsXml()).toBe(
      "<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>86400</MaxAgeSeconds></CORSRule></CORSConfiguration>",
    );
  });
});
