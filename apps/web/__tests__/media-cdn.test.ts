import type { MediaManifest } from "schema";
import { describe, expect, it } from "vitest";
import { cdnBaseUrl, createMedia, resolveMediaPaths } from "../lib/media";

// ADR-034: in a deploy the manifest comes from the CDN and every /media/ path in it is resolved
// against CDN_BASE_URL, so pictures and models load from the CDN and never from the app server.

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
          src: "/media/ships/aegs_gladius-1920-aaaaaaaaaaaa.webp",
          width: 1920,
          height: 1080,
        },
        {
          src: "/media/ships/aegs_gladius-1280-bbbbbbbbbbbb.webp",
          width: 1280,
          height: 720,
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
        src: "/media/makers/aegs-on-light.webp",
        width: 395,
        height: 128,
      },
      on_dark: {
        src: "/media/makers/aegs-on-dark.webp",
        width: 395,
        height: 128,
      },
    },
  ],
  showcase: [],
  holo: [
    {
      slug: "gladius",
      src: "/media/holo/p05ngl04o8ezx-cccccccccccc.glb",
      bytes: 1234,
      page: "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      size: [10, 4, 20],
      vertices: 100,
      triangles: 200,
    },
  ],
  holo_figure: null,
  titles: [],
  concepts: [],
  covers: [],
  spectrum: [],
};

describe("CDN_BASE_URL", () => {
  it("is null when unset or empty", () => {
    expect(cdnBaseUrl({})).toBeNull();
    expect(cdnBaseUrl({ CDN_BASE_URL: "" })).toBeNull();
  });

  it("loses its trailing slash and must be an http(s) URL", () => {
    expect(cdnBaseUrl({ CDN_BASE_URL: "https://media.coppercork.com/" })).toBe(
      "https://media.coppercork.com",
    );
    expect(cdnBaseUrl({ CDN_BASE_URL: "https://pub-abc.r2.dev" })).toBe(
      "https://pub-abc.r2.dev",
    );
    expect(() => cdnBaseUrl({ CDN_BASE_URL: "media.coppercork.com" })).toThrow(
      /not an http\(s\) URL/,
    );
  });
});

describe("resolving a manifest against the CDN", () => {
  const base = "https://media.coppercork.com";
  const resolved = resolveMediaPaths(manifest, base);

  it("prefixes every /media/ path and leaves source links alone", () => {
    expect(resolved.ships[0]!.renditions[0]!.src).toBe(
      "https://media.coppercork.com/media/ships/aegs_gladius-1920-aaaaaaaaaaaa.webp",
    );
    expect(resolved.makers[0]!.on_dark!.src).toBe(
      "https://media.coppercork.com/media/makers/aegs-on-dark.webp",
    );
    expect(resolved.holo[0]!.src).toBe(
      "https://media.coppercork.com/media/holo/p05ngl04o8ezx-cccccccccccc.glb",
    );
    expect(resolved.ships[0]!.page_url).toBe(manifest.ships[0]!.page_url);
    expect(resolved.ships[0]!.image_url).toBe(manifest.ships[0]!.image_url);
    expect(resolved.holo[0]!.size).toEqual([10, 4, 20]);
    expect(resolved.holo_figure).toBeNull();
  });

  it("gives the pages CDN addresses in src and srcset, with the credit still linking RSI", () => {
    const image = createMedia(resolved).ship("AEGS_Gladius", "Gladius");
    expect(image?.src).toBe(
      "https://media.coppercork.com/media/ships/aegs_gladius-1280-bbbbbbbbbbbb.webp",
    );
    expect(image?.srcSet).toBe(
      "https://media.coppercork.com/media/ships/aegs_gladius-1920-aaaaaaaaaaaa.webp 1920w, https://media.coppercork.com/media/ships/aegs_gladius-1280-bbbbbbbbbbbb.webp 1280w",
    );
    expect(image?.credit.href).toBe(manifest.ships[0]!.page_url);
    expect(createMedia(resolved).holo("gladius")?.src).toMatch(
      /^https:\/\/media\.coppercork\.com\//,
    );
  });

  it("leaves a local manifest's paths local when there is no CDN", () => {
    const image = createMedia(manifest).ship("AEGS_Gladius", "Gladius");
    expect(image?.src).toBe("/media/ships/aegs_gladius-1280-bbbbbbbbbbbb.webp");
  });
});
