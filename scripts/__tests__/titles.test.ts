import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TitleCatalog } from "schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitlesShapeError, toRuns } from "../titles/html.js";
import {
  iconsToFetch,
  imageKind,
  recordIcon,
  type IconSource,
} from "../titles/icons.js";
import {
  GROUP_RULES,
  packageList,
  parseTitlesArticle,
  removedSlugs,
  slugify,
} from "../titles/parse.js";
import {
  PoliteFetchError,
  USER_AGENT,
  WIKI_SPACING_MS,
  createPoliteClient,
} from "../titles/polite.js";

// The parser runs on a trimmed copy of the wiki article committed beside the catalogue
// (fixtures/titles/samples), never on the network (CLAUDE.md section 6).

const here = dirname(fileURLToPath(import.meta.url));
const titlesDir = join(here, "..", "..", "fixtures", "titles");
const sample = readFileSync(
  join(titlesDir, "samples", "Titles.sample.html"),
  "utf8",
);
const catalog = TitleCatalog.parse(
  JSON.parse(readFileSync(join(titlesDir, "Titles.json"), "utf8")),
);

const parsed = parseTitlesArticle(sample);
const bySlug = (slug: string) => {
  const found = parsed.titles.find((t) => t.slug === slug);
  if (found === undefined) throw new Error(`no ${slug} in the sample`);
  return found;
};

describe("parseTitlesArticle on the committed sample", () => {
  it("reads the revision, edit time, lead and every group in article order", () => {
    expect(parsed.revisionId).toBe(catalog.source.revision_id);
    expect(parsed.editedAt).toBe(catalog.source.edited_at);
    expect(parsed.lead[0]?.[0]?.text).toMatch(/^Titles \(also called badges\)/);
    expect(parsed.groups.map((g) => g.group)).toEqual([
      "backer",
      "recruitment",
      "guide",
      "minigame",
      "arena_commander",
      "persistent_universe",
      "website_event",
      "other",
      "unique",
      "official",
    ]);
  });

  it("reads backer titles as pledge totals with their original packages", () => {
    const civilian = bySlug("backer-civilian");
    expect(civilian.requirement).toEqual({ kind: "pledge_total", usd: 0 });
    expect(civilian.packages).toEqual(["Community Pledge"]);
    expect(civilian.earnable).toBe("yes");
    expect(bySlug("backer-scout").packages).toEqual([
      "First Responder",
      "Early Adopter",
      "I Got Two of 'Em!",
      "Quad Damage",
    ]);
    expect(civilian.icon).toMatchObject({
      file: "Title_Civilian.png",
      url: "https://media.starcitizen.tools/a/aa/Title_Civilian.png",
    });
  });

  it("reads recruitment titles with the reward name split from its text", () => {
    const recruiter = bySlug("recruitment-recruiter");
    expect(recruiter.requirement).toEqual({ kind: "recruits", count: 1 });
    expect(recruiter.reward?.name).toBe("Badger and Badges");
    expect(recruiter.reward?.text[0]?.text).toMatch(
      /^A series of UEE Squadron/,
    );
    const bonus = bySlug("recruitment-3-9-bonus");
    expect(bonus.earnable).toBe("no");
    expect(bonus.requirement).toEqual({
      kind: "recruitment_period",
      period: "April 29, 2020 – May 11, 2020",
    });
    expect(bonus.sources[0]?.url).toMatch(
      /^https:\/\/robertsspaceindustries\.com\/comm-link\//,
    );
  });

  it("reads the guide grid cell by cell and skips empty cells", () => {
    const medical = parsed.titles.filter(
      (t) =>
        t.requirement?.kind === "guide_sessions" &&
        t.requirement.track === "Medical",
    );
    expect(medical.map((t) => t.name)).toEqual(["Escort", "Instructor"]);
    expect(bySlug("guide-medical-instructor").requirement).toEqual({
      kind: "guide_sessions",
      track: "Medical",
      rank: "Instructor",
      sessions: 10,
    });
    expect(bySlug("guide-2950-yellow-flame").earnable).toBe("no");
  });

  it("keeps the wiki's sentences verbatim, links out kept, wiki links as text", () => {
    const flame = bySlug("guide-2950-yellow-flame");
    expect(flame.earned_by).toEqual([
      { text: "Completing 1 session during the ", href: null },
      {
        text: "2020 Foundation Festival",
        href: "https://robertsspaceindustries.com/comm-link/transmission/17662-Foundation-Festival-2950",
      },
      { text: ".", href: null },
    ]);
  });

  it("maps the earnable marks and leaves it empty for held titles", () => {
    const marks = new Set(
      parsed.titles
        .filter((t) => t.group === "other" || t.group === "minigame")
        .map((t) => t.earnable),
    );
    expect([...marks].sort()).toEqual(["no", "unknown", "yes"]);
    expect(bySlug("other-vip").earnable).toBe("unknown");
    expect(bySlug("other-subscriber").earnable).toBe("yes");
    expect(bySlug("minigame-class-g-license").earnable).toBe("no");
    for (const t of parsed.titles.filter(
      (x) => x.group === "unique" || x.group === "official",
    )) {
      expect(t.earnable).toBeNull();
      expect(t.earned_by).not.toBeNull();
    }
  });

  it("matches the committed catalogue, every title, group and paragraph", () => {
    // The sample keeps every table row, so a hand edit anywhere in Titles.json fails here.
    expect(parsed.titles).toEqual(catalog.titles);
    expect(parsed.groups).toEqual(catalog.groups);
    expect(parsed.lead).toEqual(catalog.lead);
  });
});

describe("parseTitlesArticle halts on shapes it does not know", () => {
  const cases: [string, (html: string) => string, RegExp][] = [
    [
      "a renamed section",
      (h) => h.replace('id="Other_titles"', 'id="Misc_titles"'),
      /sections changed/,
    ],
    [
      "a new column header",
      (h) => h.replace(">Pledge total<", ">Pledge<"),
      /header not recognised/,
    ],
    [
      "a pledge total that is not a dollar figure",
      (h) => h.replace(">$30<", ">30 dollars<"),
      /number not recognised/,
    ],
    [
      "a reworded earnable rule",
      (h) => h.replace(GROUP_RULES.backer, "Backer titles can be earned."),
      /paragraph changed/,
    ],
    [
      "a sentence added to a group's paragraph",
      (h) =>
        h.replace(
          GROUP_RULES.backer,
          `${GROUP_RULES.backer} The Civilian title can no longer be earned.`,
        ),
      /paragraph changed/,
    ],
    [
      "struck-out text in a sentence",
      (h) =>
        h.replace(
          "Completing 3 sessions during the 2020 Foundation Festival.",
          "Completing <s>3</s> sessions during the 2020 Foundation Festival.",
        ),
      /markup this parser does not know/,
    ],
    [
      "a style block in a name",
      (h) =>
        h.replace("<td>Civilian", "<td><style>.x{color:red}</style>Civilian"),
      /markup this parser does not know/,
    ],
    [
      "hidden text in a sentence",
      (h) =>
        h.replace(
          "Completing 3 sessions during",
          '<span style="display:none">SORTKEY</span>Completing 3 sessions during',
        ),
      /markup this parser does not know/,
    ],
    [
      "a seventh guide rank",
      (h) =>
        h.replace(
          /(<th><div align="center">150<br\/>Master<\/div>\s*<\/th>)/,
          '$1\n<th><div align="center">200<br/>Legend</div>\n</th>',
        ),
      /different number of ranks/,
    ],
    [
      "an earnable mark it has not seen",
      (h) => h.replace(/✔️/, "Yes"),
      /earnable mark not recognised/,
    ],
    [
      "a spanning cell",
      (h) => h.replace("<td>Civilian", '<td colspan="2">Civilian'),
      /spans rows or columns/,
    ],
    [
      "a list inside a section",
      (h) =>
        h.replace(
          '<table class="wikitable">',
          '<ul><li>new</li></ul><table class="wikitable">',
        ),
      /block this parser does not know/,
    ],
    [
      "a special guide title that is not a flame",
      (h) => h.replace("2950 - Red Flame", "2950 - Red Torch"),
      /not a flame/,
    ],
    [
      "a title row whose icon is a red link",
      (h) =>
        h.replace(
          /(<td>Civilian\s*<\/td>\s*<td>)[\s\S]*?(<\/td>)/,
          '$1<a href="/index.php?title=Special:Upload" class="new">File:Title Civilian.png</a>$2',
        ),
      /icon cell without a wiki image/,
    ],
  ];
  for (const [name, mutate, message] of cases) {
    it(name, () => {
      const changed = mutate(sample);
      expect(changed).not.toBe(sample);
      expect(() => parseTitlesArticle(changed)).toThrow(TitlesShapeError);
      expect(() => parseTitlesArticle(changed)).toThrow(message);
    });
  }
});

describe("text helpers", () => {
  it("keeps spaces outside links and drops wiki-internal links' addresses", () => {
    expect(
      toRuns(
        'Completing the <a rel="nofollow" class="external text" href="https://robertsspaceindustries.com/x"> Adventure </a> in the <a href="/Carrack" title="Carrack">Carrack</a>  sale.',
      ),
    ).toEqual([
      { text: "Completing the ", href: null },
      { text: "Adventure", href: "https://robertsspaceindustries.com/x" },
      { text: " in the Carrack sale.", href: null },
    ]);
  });

  it("decodes entities and refuses ones it does not know", () => {
    expect(toRuns("K&amp;W &quot;bonus&quot; &#39;verse")).toEqual([
      { text: 'K&W "bonus" \'verse', href: null },
    ]);
    expect(() => toRuns("&madeup;")).toThrow(TitlesShapeError);
  });

  it("reads package lists", () => {
    expect(packageList("None", "t")).toEqual([]);
    expect(packageList('"Lancer"', "t")).toEqual(["Lancer"]);
    expect(packageList('"A", "B"', "t")).toEqual(["A", "B"]);
    expect(() => packageList("Lancer and more", "t")).toThrow(TitlesShapeError);
  });

  it("lists slugs a new copy would drop", () => {
    const before = [{ slug: "a" }, { slug: "b" }, { slug: "c" }];
    expect(removedSlugs(before, [{ slug: "a" }, { slug: "c" }])).toEqual(["b"]);
    expect(removedSlugs(before, [...before, { slug: "d" }])).toEqual([]);
  });

  it("makes stable slugs", () => {
    expect(slugify("404: Ship Not Found")).toBe("404-ship-not-found");
    expect(slugify("IAE 2951 - AEGIS")).toBe("iae-2951-aegis");
    expect(slugify("Fooled!")).toBe("fooled");
    expect(() => slugify("!!")).toThrow(TitlesShapeError);
  });
});

describe("createPoliteClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function scripted(statuses: number[]) {
    const calls: { url: string; at: number; ua: string }[] = [];
    const fetch = vi.fn(
      async (url: string, init: { headers: Record<string, string> }) => {
        calls.push({
          url,
          at: Date.now(),
          ua: init.headers["User-Agent"] ?? "",
        });
        const status = statuses.shift() ?? 200;
        return {
          ok: status === 200,
          status,
          text: async () => "body",
          arrayBuffer: async () => new Uint8Array([1, 2]).buffer,
        };
      },
    );
    return { fetch, calls };
  }

  it("spaces every request, retries included, and identifies itself", async () => {
    const { fetch, calls } = scripted([200, 429, 200, 200]);
    const client = createPoliteClient({ fetch, userAgent: USER_AGENT });
    const done = Promise.all([
      client.text("https://starcitizen.tools/Titles"),
      client.bytes("https://media.starcitizen.tools/a.png"),
      client.text("https://starcitizen.tools/Titles"),
    ]);
    await vi.runAllTimersAsync();
    await done;
    expect(calls).toHaveLength(4);
    for (let i = 1; i < calls.length; i += 1) {
      const gap = (calls[i]?.at ?? 0) - (calls[i - 1]?.at ?? 0);
      expect(gap).toBeGreaterThanOrEqual(WIKI_SPACING_MS);
    }
    expect(calls.every((c) => c.ua === USER_AGENT)).toBe(true);
    expect(client.requests).toBe(4);
  });

  it("gives up on a status that retrying will not fix", async () => {
    const { fetch } = scripted([404]);
    const client = createPoliteClient({ fetch, userAgent: USER_AGENT });
    const result = client
      .text("https://starcitizen.tools/Nope")
      .catch((e) => e);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(PoliteFetchError);
  });
});

describe("title icons", () => {
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0,
  ]);

  it("plans each shared icon once and skips copies already on file", () => {
    const all = iconsToFetch(catalog, [], () => false);
    const distinct = new Set(
      catalog.titles.flatMap((t) => (t.icon === null ? [] : [t.icon.file])),
    );
    expect(all).toHaveLength(distinct.size);
    expect(distinct.size).toBeLessThan(catalog.titles.length);

    const first = all[0];
    if (first === undefined) throw new Error("no icons");
    const done: IconSource[] = [recordIcon(first, png, "2026-11-08T00:00:00Z")];
    expect(iconsToFetch(catalog, done, () => true)).toHaveLength(
      all.length - 1,
    );
    // A copy whose file has gone, or whose address changed, is fetched again.
    expect(iconsToFetch(catalog, done, () => false)).toHaveLength(all.length);
    const moved = [{ ...done[0], url: `${first.url}?old` } as IconSource];
    expect(iconsToFetch(catalog, moved, () => true)).toHaveLength(all.length);
  });

  it("refuses a download that is not the image its name says", () => {
    expect(imageKind(png)).toBe("png");
    expect(
      imageKind(new TextEncoder().encode('<?xml version="1.0"?><svg/>')),
    ).toBe("svg");
    const page = new TextEncoder().encode(
      "<!doctype html><title>Error</title>",
    );
    expect(() =>
      recordIcon(
        { file: "Title_X.png", url: "https://media.starcitizen.tools/x.png" },
        page,
        "2026-11-08T00:00:00Z",
      ),
    ).toThrow(TitlesShapeError);
    expect(() =>
      recordIcon(
        { file: "Title_X.jpg", url: "https://media.starcitizen.tools/x.jpg" },
        png,
        "2026-11-08T00:00:00Z",
      ),
    ).toThrow(TitlesShapeError);
  });

  it("refuses a file name that could leave the folder", () => {
    const bad = {
      ...catalog,
      titles: [
        {
          ...catalog.titles[0]!,
          icon: { ...catalog.titles[0]!.icon!, file: "..\\evil.png" },
        },
      ],
    };
    expect(() => iconsToFetch(bad, [], () => false)).toThrow(TitlesShapeError);
  });
});
