import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEALT_SECTIONS,
  articleUrl,
  captionFor,
  chooseItems,
  composeShowcase,
  parseGallery,
} from "../media/gallery.js";

const sample = readFileSync(
  new URL(
    "../../fixtures/galleries/samples/gladius.sample.html",
    import.meta.url,
  ),
  "utf8",
);

describe("parseGallery", () => {
  const gallery = parseGallery(sample);

  it("reads the official and in-game tabs, each upload once, with its original and size", () => {
    expect(gallery.official.length).toBeGreaterThan(10);
    expect(gallery.ingame.length).toBeGreaterThan(3);
    const first = gallery.official[0]!;
    expect(first.file).toBe("Gladius_-_Take_off.jpg");
    expect(first.url).toBe(
      "https://media.starcitizen.tools/d/d0/Gladius_-_Take_off.jpg",
    );
    expect(first.width).toBe(3820);
    expect(first.height).toBe(2160);
    expect(first.kind).toBe("official");
    const urls = [...gallery.official, ...gallery.ingame].map((i) => i.url);
    expect(new Set(urls).size).toBe(urls.length);
    for (const i of gallery.ingame) expect(i.kind).toBe("ingame");
  });

  it("returns nothing for an article without a gallery", () => {
    expect(
      parseGallery("<html><body><p>No gallery here.</p></body></html>"),
    ).toEqual({
      official: [],
      ingame: [],
    });
  });
});

describe("chooseItems", () => {
  it("takes the first official pictures, then in-game ones, skipping logos and small files", () => {
    const gallery = parseGallery(sample);
    const chosen = chooseItems(gallery, { official: 8, ingame: 4 });
    expect(chosen.length).toBeLessThanOrEqual(12);
    expect(chosen.filter((i) => i.kind === "official").length).toBe(8);
    expect(chosen.filter((i) => i.kind === "ingame").length).toBe(4);
    const withLogo = {
      official: [
        {
          file: "Gladius_logo.png",
          url: "https://media.starcitizen.tools/a/a1/Gladius_logo.png",
          width: 2000,
          height: 800,
          kind: "official" as const,
        },
        {
          file: "Gladius_Tiny.jpg",
          url: "https://media.starcitizen.tools/a/a2/Gladius_Tiny.jpg",
          width: 300,
          height: 200,
          kind: "official" as const,
        },
        {
          file: "Gladius_-_Take_off.jpg",
          url: "https://media.starcitizen.tools/d/d0/Gladius_-_Take_off.jpg",
          width: 3820,
          height: 2160,
          kind: "official" as const,
        },
      ],
      ingame: [],
    };
    expect(
      chooseItems(withLogo, { official: 8, ingame: 4 }).map((i) => i.file),
    ).toEqual(["Gladius_-_Take_off.jpg"]);
  });
});

describe("captionFor", () => {
  it("says what kind of picture it is and nothing the file title might claim", () => {
    expect(captionFor("official", "Gladius")).toBe("Gladius, official art");
    expect(captionFor("ingame", "Avenger Stalker")).toBe(
      "Avenger Stalker, in the game",
    );
  });
});

describe("composeShowcase", () => {
  const item = (key: string) => ({
    key,
    caption: key,
    kind: "official" as const,
  });

  it("deals the cover, the poster, one figure per section in order, and the rest to the gallery", () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`k${i}`));
    const c = composeShowcase(items);
    expect(c.roles).toEqual({ background: "k0", poster: "k1" });
    expect(c.figures.map((f) => f.section)).toEqual([...DEALT_SECTIONS]);
    expect(c.figures.map((f) => f.key)).toEqual([
      "k2",
      "k3",
      "k4",
      "k5",
      "k6",
      "k7",
      "k8",
    ]);
    expect(c.gallery).toEqual(["k1", "k9", "k10", "k11"]);
  });

  it("copes with one or two pictures, and with none", () => {
    expect(composeShowcase([item("a")])).toEqual({
      roles: { background: "a", poster: "a" },
      figures: [],
      gallery: [],
    });
    expect(composeShowcase([item("a"), item("b")]).figures).toEqual([]);
    expect(composeShowcase([])).toEqual({
      roles: {},
      figures: [],
      gallery: [],
    });
  });
});

describe("articleUrl", () => {
  it("names the wiki article from the display name", () => {
    expect(articleUrl("MISC Freelancer MAX")).toBe(
      "https://starcitizen.tools/MISC_Freelancer_MAX",
    );
    expect(articleUrl("San'tok.yāi")).toBe(
      "https://starcitizen.tools/San'tok.y%C4%81i",
    );
  });
});
