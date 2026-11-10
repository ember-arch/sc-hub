import { MediaManifest } from "schema";
import { describe, expect, it } from "vitest";
import { WIKI_GALLERY_CREDIT } from "ui/legal";
import { createMedia, parseMediaManifest } from "../lib/media";

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
  showcase: [
    {
      slug: "basher",
      article: null,
      wiki_article: "https://starcitizen.tools/Basher",
      images: [
        {
          key: "cover",
          renditions: [
            {
              src: "/media/showcase/basher/cover-1600.webp",
              width: 1600,
              height: 900,
            },
            {
              src: "/media/showcase/basher/cover-1280.webp",
              width: 1280,
              height: 720,
            },
          ],
          has_alpha: false,
        },
        {
          key: "second",
          renditions: [
            {
              src: "/media/showcase/basher/second-1600.webp",
              width: 1600,
              height: 1000,
            },
          ],
          has_alpha: false,
        },
      ],
      videos: [],
      model: null,
      roles: { background: "cover", poster: "second" },
      chapters: [],
      gallery: [],
      schematics: [],
      figures: [],
    },
    {
      slug: "nowhere",
      article: null,
      wiki_article: null,
      images: [],
      videos: [],
      model: null,
      roles: {},
      chapters: [],
      gallery: [],
      schematics: [],
      figures: [],
    },
  ],
  holo: [],
  holo_figure: null,
  titles: [],
  concepts: [
    {
      slug: "odin",
      source: "rsi_ship_matrix",
      page_url: "https://robertsspaceindustries.com/pledge/ships/odin/Odin",
      image_url: "https://media.robertsspaceindustries.com/x/odin.jpg",
      fetched_at: "2026-11-09T06:00:00.000Z",
      renditions: [
        { src: "/media/concepts/odin-1920.webp", width: 1920, height: 1080 },
        { src: "/media/concepts/odin-1280.webp", width: 1280, height: 720 },
      ],
    },
  ],
  covers: [
    {
      external_id: "21445",
      source: "rsi_comm_link_hub",
      page_url:
        "https://robertsspaceindustries.com/comm-link/transmission/21445-This-Week-In-Star-Citizen",
      image_url:
        "https://media.robertsspaceindustries.com/47458res1wwdv/channel_item_full.jpg",
      fetched_at: "2026-11-10T20:00:00.000Z",
      renditions: [
        { src: "/media/covers/21445-1280.webp", width: 1280, height: 720 },
        { src: "/media/covers/21445-640.webp", width: 640, height: 360 },
      ],
    },
  ],
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

  it("gives a dispatch card its Comm-Link's cover by RSI's id, with an empty alt and RSI's credit on the Comm-Link's page (ADR-029)", () => {
    const cover = media.cover("21445");
    expect(cover).toEqual({
      src: "/media/covers/21445-1280.webp",
      width: 1280,
      height: 720,
      srcSet:
        "/media/covers/21445-1280.webp 1280w, /media/covers/21445-640.webp 640w",
      alt: "",
      credit: {
        text: "Image: Roberts Space Industries",
        href: "https://robertsspaceindustries.com/comm-link/transmission/21445-This-Week-In-Star-Citizen",
      },
    });
    expect(media.cover("1")).toBeNull();
    // A manifest built before covers existed parses with none.
    const older = { ...manifest } as Record<string, unknown>;
    delete older["covers"];
    expect(
      createMedia(parseMediaManifest(JSON.stringify(older))).cover("21445"),
    ).toBeNull();
  });

  it("describes a concept ship's image by slug, credited to its RSI page (ADR-022)", () => {
    const media = createMedia(manifest);
    const image = media.concept("odin", "Odin");
    expect(image?.alt).toBe("The Odin");
    expect(image?.src).toBe("/media/concepts/odin-1280.webp");
    expect(image?.srcSet).toContain("/media/concepts/odin-1920.webp 1920w");
    expect(image?.credit.href).toBe(
      "https://robertsspaceindustries.com/pledge/ships/odin/Odin",
    );
    expect(media.concept("odin", null)?.alt).toBe("");
    expect(media.concept("nova", "Nova")).toBeNull();
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

describe("showcaseCard", () => {
  const media = createMedia(MediaManifest.parse(manifest));

  it("gives a card the showcase's cover, the 1280 copy as fallback, credited to the wiki's article", () => {
    const card = media.showcaseCard("basher");
    expect(card).toEqual({
      src: "/media/showcase/basher/cover-1280.webp",
      width: 1600,
      height: 900,
      srcSet:
        "/media/showcase/basher/cover-1600.webp 1600w, /media/showcase/basher/cover-1280.webp 1280w",
      alt: "",
      credit: {
        text: WIKI_GALLERY_CREDIT.text,
        href: "https://starcitizen.tools/Basher",
      },
    });
  });

  it("gives nothing for a showcase without a cover or a source, and for a slug it does not know", () => {
    expect(media.showcaseCard("nowhere")).toBeNull();
    expect(media.showcaseCard("odin")).toBeNull();
  });
});
