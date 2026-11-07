import { Manufacturer } from "schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildRepository } from "../lib/data";
import {
  absolute,
  jsonLdHtml,
  manufacturerJsonLd,
  shipJsonLd,
  siteUrl,
} from "../lib/seo";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "SEO": the public origin, absolute URLs and the JSON-LD for ships and
// manufacturers. Rows come from the fixture pack; the branches the pack never reaches (a ship
// without stats or manufacturer, a manufacturer with a description) use copies of fixture rows.

const r = buildRepository(bootstrapPack(), []);
const ship = r.ships[0];
const maker = r.manufacturers[0];
if (ship === undefined || maker === undefined) throw new Error("empty pack");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("siteUrl", () => {
  it("prefers SITE_URL, then the Vercel production URL, then the local origin", () => {
    vi.stubEnv("SITE_URL", "https://site.example.test");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "app.example.test");
    expect(siteUrl().origin).toBe("https://site.example.test");
    vi.stubEnv("SITE_URL", "");
    expect(siteUrl().origin).toBe("https://app.example.test");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(siteUrl().origin).toBe("http://localhost:3000");
  });

  it("refuses to build production with no origin rather than publish localhost", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(() => siteUrl()).toThrow(/SITE_URL is required/);
  });

  it("resolves site paths against the origin", () => {
    vi.stubEnv("SITE_URL", "https://site.example.test");
    expect(absolute("/ships/a")).toBe("https://site.example.test/ships/a");
  });
});

describe("shipJsonLd", () => {
  it("passes the pack's facts through, with the build on every stat", () => {
    const ld = shipJsonLd(ship, "description");
    expect(ld["@type"]).toBe("Vehicle");
    expect(ld["name"]).toBe(ship.vehicle.name);
    if (ship.stats !== null) {
      expect(ld["weight"]).toEqual({
        "@type": "QuantitativeValue",
        value: ship.stats.mass_kg,
        unitCode: "KGM",
      });
      expect(ld["additionalProperty"]).toEqual([
        {
          "@type": "PropertyValue",
          name: "channel",
          value: ship.stats.channel,
        },
        {
          "@type": "PropertyValue",
          name: "game_version",
          value: ship.stats.game_version,
        },
      ]);
      if (ship.stats.cargo_scu !== null) {
        expect(ld["cargoVolume"]).toEqual({
          "@type": "QuantitativeValue",
          value: ship.stats.cargo_scu,
          unitText: "SCU",
        });
      }
    }
    // Nothing the data model does not have: no seating capacity, no identity claims.
    expect(ld).not.toHaveProperty("vehicleSeatingCapacity");
    expect(ld).not.toHaveProperty("sameAs");
  });

  it("leaves out what the pack lacks", () => {
    const bare = {
      ...ship,
      stats: null,
      manufacturer: null,
      vehicle: { ...ship.vehicle, role: null },
    };
    const ld = shipJsonLd(bare, "description");
    for (const key of [
      "weight",
      "cargoVolume",
      "additionalProperty",
      "manufacturer",
      "category",
    ]) {
      expect(ld, key).not.toHaveProperty(key);
    }
    if (ship.stats !== null) {
      const noCargo = shipJsonLd(
        { ...ship, stats: { ...ship.stats, cargo_scu: null } },
        "description",
      );
      expect(noCargo).not.toHaveProperty("cargoVolume");
      expect(noCargo).toHaveProperty("weight");
    }
  });
});

describe("manufacturerJsonLd", () => {
  it("is an Organization with its own page and no claim to be CIG's site", () => {
    const ld = manufacturerJsonLd(maker);
    expect(ld["@type"]).toBe("Organization");
    expect(String(ld["url"])).toMatch(
      new RegExp(`/manufacturers/${maker.slug}$`),
    );
    expect(ld).not.toHaveProperty("sameAs");
  });

  it("includes a description only when the pack has one", () => {
    expect(
      manufacturerJsonLd({ ...maker, description: "" }),
    ).not.toHaveProperty("description");
    const described = Manufacturer.parse({
      ...maker,
      description: "Localization text",
    });
    expect(manufacturerJsonLd(described)["description"]).toBe(
      "Localization text",
    );
  });
});

describe("jsonLdHtml", () => {
  it("escapes < so a value cannot close the script block", () => {
    const html = jsonLdHtml({ name: "</script><script>alert(1)</script>" });
    expect(html).not.toContain("<");
    expect(html).toContain("\\u003c/script>");
    expect(JSON.parse(html)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});
