import { describe, expect, it } from "vitest";
import {
  GROUP_LABELS,
  countLine,
  filterTitles,
  groupSlug,
  guideGrid,
  hasTitleFilters,
  loadTitleCatalog,
  parseTitleQuery,
  statusOf,
  titleSearchEntries,
  titleSections,
  titlesHref,
} from "../lib/titles";
import { iconImage } from "../lib/title-icons";

// The titles page's URL state and grouping, on the committed catalogue (fixtures/titles).

const catalog = loadTitleCatalog();
if (catalog === null) throw new Error("fixtures/titles/Titles.json is missing");
const all = catalog.titles;

describe("parseTitleQuery", () => {
  it("reads search, group and status, and ignores values it does not know", () => {
    expect(
      parseTitleQuery({
        q: "  iae ",
        group: "arena-commander",
        status: "earnable",
      }),
    ).toEqual({ q: "iae", group: "arena_commander", status: "earnable" });
    expect(parseTitleQuery({ group: "nope", status: "maybe" })).toEqual({
      q: "",
      group: null,
      status: null,
    });
    expect(parseTitleQuery({ q: ["a", "b"] }).q).toBe("a");
    expect(parseTitleQuery({ q: "x".repeat(500) }).q).toHaveLength(100);
  });

  it("round-trips through the page address", () => {
    const query = parseTitleQuery({
      q: "flame",
      group: "guide",
      status: "not-earnable",
    });
    expect(titlesHref(query)).toBe(
      "/titles?q=flame&group=guide&status=not-earnable",
    );
    expect(titlesHref(parseTitleQuery({}))).toBe("/titles");
    expect(hasTitleFilters(parseTitleQuery({}))).toBe(false);
  });
});

describe("filterTitles", () => {
  it("shows everything with no filters", () => {
    expect(filterTitles(all, parseTitleQuery({}))).toHaveLength(all.length);
  });

  it("finds titles by name, track, the wiki's sentence and package, ignoring case", () => {
    const names = (q: string) =>
      filterTitles(all, parseTitleQuery({ q })).map((t) => t.slug);
    expect(names("legatus")).toEqual(["backer-legatus"]);
    expect(names("MINING")).toContain("guide-mining-escort");
    expect(names("foundation festival")).toEqual([
      "guide-2950-yellow-flame",
      "guide-2950-orange-flame",
      "guide-2950-red-flame",
    ]);
    expect(names("go boldly")).toEqual([
      "backer-lt-commander",
      "backer-space-marshal",
    ]);
    expect(names("no such title anywhere")).toEqual([]);
  });

  it("filters by group and status together", () => {
    const shown = filterTitles(
      all,
      parseTitleQuery({ group: "arena-commander", status: "earnable" }),
    );
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((t) => t.group === "arena_commander")).toBe(true);
    expect(shown.every((t) => t.earnable === "yes")).toBe(true);
    // Unique and official titles have no earnable status, so a status filter leaves them out.
    expect(
      filterTitles(all, parseTitleQuery({ status: "not-earnable" })).some(
        (t) => statusOf(t) === null,
      ),
    ).toBe(false);
  });
});

describe("titleSections", () => {
  it("keeps the wiki's group order and drops groups with nothing to show", () => {
    const sections = titleSections(catalog, all);
    expect(sections.map((s) => s.group)).toEqual(
      catalog.groups.map((g) => g.group),
    );
    expect(sections.reduce((n, s) => n + s.titles.length, 0)).toBe(all.length);
    const one = titleSections(
      catalog,
      filterTitles(all, parseTitleQuery({ q: "legatus" })),
    );
    expect(one.map((s) => s.group)).toEqual(["backer"]);
    expect(one[0]?.total).toBe(all.filter((t) => t.group === "backer").length);
  });

  it("labels every group in sentence case with a URL-safe slug", () => {
    for (const g of catalog.groups) {
      expect(GROUP_LABELS[g.group]).toMatch(/^[A-Z][^A-Z]*( [A-Z][a-z]+)*$/);
      expect(groupSlug(g.group)).toMatch(/^[a-z-]+$/);
    }
  });
});

describe("guideGrid", () => {
  it("lays the guide titles out by track and rank, sessions ascending", () => {
    const grid = guideGrid(all.filter((t) => t.group === "guide"));
    expect(grid.ranks.map((r) => r.sessions)).toEqual(
      [...grid.ranks.map((r) => r.sessions)].sort((a, b) => a - b),
    );
    const medical = grid.tracks.find((t) => t.track === "Medical");
    expect(medical?.cells.map((c) => c?.name ?? null)).toEqual([
      "Escort",
      "Instructor",
      null,
      null,
      null,
      null,
    ]);
    const cells = grid.tracks.flatMap((t) => t.cells).filter((c) => c !== null);
    expect(cells).toHaveLength(
      all.filter((t) => t.requirement?.kind === "guide_sessions").length,
    );
  });
});

describe("titleSearchEntries", () => {
  it("links every title to its place on the page", () => {
    const entries = titleSearchEntries(catalog);
    expect(entries).toHaveLength(all.length);
    expect(entries.every((e) => e.type === "title")).toBe(true);
    expect(
      entries.find((e) => e.href === "/titles#guide-mining-escort")?.meta,
    ).toBe("Guide · Mining");
    expect(titleSearchEntries(null)).toEqual([]);
  });
});

describe("countLine", () => {
  const titles = (slugs: string[]) =>
    slugs.map((s) => {
      const t = all.find((x) => x.slug === s);
      if (t === undefined) throw new Error(`no ${s}`);
      return t;
    });

  it("says how many can still be earned, and counts unknown apart", () => {
    expect(
      countLine(titles(["backer-civilian", "backer-scout"]), 16, false),
    ).toBe("2 titles · all earnable");
    expect(countLine(titles(["other-vip", "other-humbug"]), 19, true)).toBe(
      "2 of 19 titles · status unknown",
    );
    expect(
      countLine(
        titles(["other-subscriber", "other-golden-ticket", "other-vip"]),
        19,
        true,
      ),
    ).toBe("3 of 19 titles · 1 earnable · 1 status unknown");
    expect(countLine(titles(["website-event-fooled"]), 1, true)).toBe(
      "1 title · none earnable now",
    );
    expect(countLine(titles(["official-staff"]), 7, false)).toBe("1 title");
  });
});

describe("iconImage", () => {
  it("serves the small copy by default and the large one to 2x screens", () => {
    const image = iconImage({
      file: "Title_X.png",
      width: 1000,
      height: 993,
      renditions: [
        { src: "/media/titles/title-x-png-128.webp", width: 128, height: 127 },
        { src: "/media/titles/title-x-png-64.webp", width: 64, height: 64 },
      ],
    });
    expect(image).toMatchObject({
      src: "/media/titles/title-x-png-64.webp",
      width: 64,
      srcSet:
        "/media/titles/title-x-png-128.webp 2x, /media/titles/title-x-png-64.webp 1x",
      naturalWidth: 1000,
    });
  });
});
