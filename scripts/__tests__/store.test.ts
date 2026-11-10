import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  STORE_PAGE_SIZE,
  StoreShapeError,
  matchModels,
  modelFile,
  modelOf,
  modelUrl,
  pagePath,
  parseShipList,
  shipListBody,
} from "../media/store.js";

const sample: unknown = JSON.parse(
  readFileSync(
    new URL(
      "../../fixtures/holo/samples/store-list.sample.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("shipListBody", () => {
  it("asks for one page of every ship, by name, with the model address", () => {
    const body = JSON.parse(shipListBody(3)) as {
      query: string;
      variables: { query: Record<string, unknown> };
    };
    expect(body.query).toContain("media { ctm }");
    expect(body.variables.query).toEqual({
      page: 3,
      limit: STORE_PAGE_SIZE,
      sort: { field: "name", direction: "asc" },
      ships: { all: true },
    });
  });
});

describe("parseShipList", () => {
  it("reads a page of the store's listing", () => {
    const ships = parseShipList(sample);
    expect(ships).toHaveLength(30);
    expect(ships[0]).toMatchObject({
      title: "100i",
      url: "/pledge/ships/origin-100/100i",
      media: { ctm: "/media/3pbu69b7j423kr/source/Origin_100i_v2.ctm" },
    });
    expect(ships.filter((s) => modelOf(s) !== null)).toHaveLength(29);
  });

  it("halts on an answer that is not a listing", () => {
    expect(() => parseShipList({ data: { store: null } })).toThrow(
      StoreShapeError,
    );
    expect(() =>
      parseShipList({ errors: [{ message: "Internal server error" }] }),
    ).toThrow(/answered with errors/);
  });
});

describe("pagePath, modelUrl and modelFile", () => {
  it("compares pledge pages without origin or language", () => {
    expect(
      pagePath(
        "https://robertsspaceindustries.com/pledge/ships/gladius/Gladius",
      ),
    ).toBe("/pledge/ships/gladius/Gladius");
    expect(pagePath("/en/pledge/ships/gladius/Gladius")).toBe(
      "/pledge/ships/gladius/Gladius",
    );
    expect(pagePath("/pledge/ships/gladius/Gladius/")).toBe(
      "/pledge/ships/gladius/Gladius",
    );
  });

  it("resolves the model against the store's origin and names the file by RSI's media id", () => {
    expect(modelUrl("/media/oibvdxxco2narr/source/AEGIS-Gladius2.ctm")).toBe(
      "https://robertsspaceindustries.com/media/oibvdxxco2narr/source/AEGIS-Gladius2.ctm",
    );
    expect(modelFile("/media/oibvdxxco2narr/source/AEGIS-Gladius2.ctm")).toBe(
      "oibvdxxco2narr.ctm",
    );
    expect(
      modelFile(
        "https://media.robertsspaceindustries.com/mhwmpvt2e8h0w/source.ctm",
      ),
    ).toBe("mhwmpvt2e8h0w.ctm");
    expect(() => modelFile("/static/ctm/man.ctm")).toThrow(StoreShapeError);
    expect(() =>
      modelFile("https://media.robertsspaceindustries.com/source.ctm"),
    ).toThrow(StoreShapeError);
  });
});

describe("matchModels", () => {
  const store = parseShipList(sample);

  it("gives a catalog ship the model of the store ship on its recorded page, and only that", () => {
    const result = matchModels(
      [
        {
          slug: "orig-100i",
          page_url:
            "https://robertsspaceindustries.com/pledge/ships/origin-100/100i",
        },
        {
          slug: "orig-85x",
          page_url: "https://robertsspaceindustries.com/pledge/ships/85x/85X",
        },
        {
          slug: "nowhere",
          page_url:
            "https://robertsspaceindustries.com/pledge/ships/nowhere/Nowhere",
        },
      ],
      store,
    );
    expect(result.matched).toEqual([
      {
        slug: "orig-100i",
        page: "https://robertsspaceindustries.com/pledge/ships/origin-100/100i",
        url: "https://robertsspaceindustries.com/media/3pbu69b7j423kr/source/Origin_100i_v2.ctm",
        file: "3pbu69b7j423kr.ctm",
        store_title: "100i",
      },
    ]);
    expect(result.unmatched).toEqual([
      { slug: "orig-85x", reason: "the store has no model" },
      { slug: "nowhere", reason: "the store lists no ship on this page" },
    ]);
    expect(result.unused).toHaveLength(28);
  });

  it("refuses a page two store ships share", () => {
    const twin = { ...store[0]!, id: "twin" };
    const result = matchModels(
      [{ slug: "orig-100i", page_url: "/pledge/ships/origin-100/100i" }],
      [...store, twin],
    );
    expect(result.matched).toEqual([]);
    expect(result.unmatched[0]?.reason).toBe("2 store ships share this page");
  });
});
