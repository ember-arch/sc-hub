import { MediaManifest } from "schema";
import { describe, expect, it } from "vitest";
import { type ShowcaseLookup, bandArt } from "../lib/bands";
import { createMedia, parseMediaManifest } from "../lib/media";
import type { Picture, ShowcaseView } from "../lib/showcase";

// ADR-009: the site only shows images the manifest lists, credited to their source.

const manifest: MediaManifest = {
  generated_at: "2026-11-08T06:00:00.000Z",
  ships: [
    {
      class_name: "AEGS_Gladius",
      source: "rsi_ship_matrix",
      page_url:
        "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      image_url:
        "https://media.robertsspaceindustries.com/asbrpwjjho1z0/wallpaper_1920x1080.jpg",
      fetched_at: "2026-11-08T05:59:56.134Z",
      renditions: [
        {
          src: "/media/ships/aegs_gladius-1920.webp",
          width: 1920,
          height: 1080,
        },
        {
          src: "/media/ships/aegs_gladius-1280.webp",
          width: 1280,
          height: 720,
        },
        { src: "/media/ships/aegs_gladius-640.webp", width: 640, height: 360 },
      ],
    },
  ],
  makers: [
    {
      manufacturer_code: "MRAI",
      source: "fankit",
      fankit_version: "2025_11_19",
      on_light: {
        src: "/media/makers/mrai-on-light.webp",
        width: 395,
        height: 128,
      },
      on_dark: null,
    },
  ],
  showcase: [],
  holo: [],
  holo_figure: null,
  titles: [],
};

describe("createMedia", () => {
  const media = createMedia(MediaManifest.parse(manifest));

  it("describes a ship's image with every rendition, the 1280 fallback and RSI's credit", () => {
    expect(media.ship("AEGS_Gladius", "Gladius")).toEqual({
      src: "/media/ships/aegs_gladius-1280.webp",
      width: 1920,
      height: 1080,
      srcSet:
        "/media/ships/aegs_gladius-1920.webp 1920w, /media/ships/aegs_gladius-1280.webp 1280w, /media/ships/aegs_gladius-640.webp 640w",
      alt: "The Gladius",
      credit: {
        text: "Image: Roberts Space Industries",
        href: "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      },
    });
  });

  it("gives a card's image an empty alt, since the card names the ship", () => {
    expect(media.shipCard("AEGS_Gladius")?.alt).toBe("");
  });

  it("returns null for anything the manifest does not list", () => {
    expect(media.ship("RSI_Polaris", "Polaris")).toBeNull();
    expect(media.maker("AEGS", "Aegis Dynamics")).toBeNull();
  });

  it("keeps a missing light mark missing instead of reusing the dark one", () => {
    expect(media.maker("MRAI", "Mirai")).toEqual({
      alt: "Mirai logo",
      onLight: {
        src: "/media/makers/mrai-on-light.webp",
        width: 395,
        height: 128,
      },
      onDark: null,
    });
  });

  it("returns null for everything when no manifest has been built", () => {
    const none = createMedia(null);
    expect(none.ship("AEGS_Gladius", "Gladius")).toBeNull();
    expect(none.maker("MRAI", "Mirai")).toBeNull();
  });
});

describe("bandArt", () => {
  const picture = (key: string): Picture => ({
    src: `/media/showcase/odin/${key}-3840.webp`,
    srcSet: "",
    width: 3840,
    height: 2160,
    alt: "",
  });
  const show = (over: Partial<ShowcaseView>): ShowcaseLookup => {
    const base = {
      slug: "odin",
      article: null,
      background: picture("sc-odin-key-background-2"),
      cutout: null,
      poster: picture("sc-anvil-odin-exterior-5"),
      topdown: null,
      intro: null,
      chapters: [],
      gallery: [picture("render-9"), picture("sc-anvil-odin-exterior-3")],
      schematics: [],
      figures: {},
    } as unknown as ShowcaseView;
    return () => ({ ...base, ...over });
  };

  it("is null without media, so the masthead stands on the page colour", () => {
    expect(bandArt("ships", () => null)).toBeNull();
  });

  it("picks each page's piece by role or image key, not by gallery order", () => {
    expect(bandArt("funding", show({}))?.src).toContain("key-background-2");
    expect(bandArt("titles", show({}))?.src).toContain("exterior-5");
    expect(bandArt("components", show({}))?.src).toContain("exterior-3");
  });

  it("falls back to the background when a poster or a gallery key is missing", () => {
    expect(bandArt("titles", show({ poster: null }))?.src).toContain(
      "key-background-2",
    );
    expect(bandArt("components", show({ gallery: [] }))?.src).toContain(
      "key-background-2",
    );
  });
});

describe("parseMediaManifest", () => {
  it("validates a manifest and rejects a ship with no renditions", () => {
    expect(parseMediaManifest(JSON.stringify(manifest)).ships).toHaveLength(1);
    expect(() =>
      parseMediaManifest(
        JSON.stringify({
          ...manifest,
          ships: [{ ...manifest.ships[0], renditions: [] }],
        }),
      ),
    ).toThrow();
  });

  it("rejects a rendition outside /media/", () => {
    expect(() =>
      MediaManifest.parse({
        ...manifest,
        makers: [
          {
            ...manifest.makers[0],
            on_light: {
              src: "https://media.robertsspaceindustries.com/x.png",
              width: 1,
              height: 1,
            },
          },
        ],
      }),
    ).toThrow();
  });
});
