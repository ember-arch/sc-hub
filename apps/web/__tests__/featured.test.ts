import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventRecord } from "schema";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, repo } from "../lib/data";
import {
  type FeaturedCandidate,
  type FeaturedInput,
  FEATURED_COUNT,
  NEWS_DAYS,
  RELEASE_DAYS,
  companions,
  featuredShips,
  makerWords,
  newShips,
  playStyles,
  shipsNamedIn,
} from "../lib/featured";
import { shipResolver } from "../lib/events";
import { newsMentions, showInput } from "../lib/featured-sources";
import { utcDayNumber, utcWeekNumber } from "../lib/front";
import { snapshotOf } from "../lib/patches";

// ADR-060: the front page's featured ships follow what is on in the game.

const ship = (
  slug: string,
  name: string,
  makerCode: string,
  role: string | null,
  hasPicture = true,
): FeaturedCandidate => ({
  slug,
  name,
  makerCode,
  role,
  hasPicture,
  length: null,
});

const SHIPS: FeaturedCandidate[] = [
  ship("perseus", "Perseus", "RSI", "Heavy Gunship"),
  ship("odin", "Odin", "ANVL", "Battlecruiser"),
  ship("galaxy", "Galaxy", "RSI", "Modular"),
  ship("liberator", "Liberator", "ANVL", "Dropship"),
  ship("valkyrie", "Valkyrie", "ANVL", "Dropship"),
  ship("hoplite", "Vanguard Hoplite", "AEGS", "Dropship"),
  ship("skylark", "Skylark", "RSI", "Snub Fighter"),
  ship("fury", "Fury", "MRAI", "Snub Fighter"),
  ship("gladius", "Gladius", "AEGS", "Light Fighter"),
  ship("arrow", "Arrow", "ANVL", "Light Fighter"),
  ship("andromeda", "Constellation Mk IV Andromeda", "RSI", "Medium Freight"),
  ship("taurus", "Constellation Mk IV Taurus", "RSI", "Medium Freight"),
  ship("centaurus", "Constellation Mk V Centaurus", "RSI", "Medium Freight"),
  ship("aurora", "Aurora", "RSI", "Starter, Light Fighter"),
  ship("aurora-mk-ii", "Aurora Mk II", "RSI", "Starter, Pathfinder"),
  ship("prospector", "Prospector", "MISC", "Light Mining"),
  ship("mole", "MOLE", "ARGO", "Medium Mining"),
  ship("hull-a", "Hull A", "MISC", "Light Freight"),
  ship("bare", "Bare", "DRAK", "Light Freight", false),
];

const NOW = new Date("2026-12-09T10:00:00Z"); // a Wednesday with nothing on
const base = (
  over: Partial<FeaturedInput<FeaturedCandidate>> = {},
): FeaturedInput<FeaturedCandidate> => ({
  candidates: SHIPS,
  now: NOW,
  pair: { live: "perseus", concept: "odin" },
  show: null,
  release: null,
  news: [],
  ...over,
});
const slugs = (input: FeaturedInput<FeaturedCandidate>) =>
  featuredShips(input).picks.map((p) => p.ship.slug);

describe("playStyles", () => {
  it("reads the kinds of play a role names, its size words aside", () => {
    expect([...playStyles("Light Freight, Medium Fighter")]).toEqual([
      "freight",
      "fighter",
    ]);
    expect([...playStyles("Multi-Role / Light Carrier")]).toEqual([
      "multi-role",
      "carrier",
    ]);
    expect([...playStyles("Snub Fighter")]).toEqual(["fighter"]);
    expect([...playStyles(null)]).toEqual([]);
  });
});

describe("utcWeekNumber", () => {
  it("turns on Monday, 00:00 UTC", () => {
    const sunday = utcDayNumber(new Date("2026-12-13T23:59:00Z"));
    const monday = utcDayNumber(new Date("2026-12-14T00:00:00Z"));
    const lastMonday = utcDayNumber(new Date("2026-12-07T00:00:00Z"));
    expect(utcWeekNumber(sunday)).toBe(utcWeekNumber(lastMonday));
    expect(utcWeekNumber(monday)).toBe(utcWeekNumber(sunday) + 1);
  });
});

describe("a week with nothing on", () => {
  it("is the showcase pair and three drawn for the week, the same all week", () => {
    const set = featuredShips(base());
    expect(set.theme.kind).toBe("week");
    expect(set.cadence).toBe("weekly");
    expect(set.picks).toHaveLength(FEATURED_COUNT);
    expect(set.picks.slice(0, 2).map((p) => p.ship.slug)).toEqual([
      "perseus",
      "odin",
    ]);
    expect(set.picks.slice(0, 2).every((p) => p.why.kind === "pair")).toBe(
      true,
    );
    // Monday to Sunday draw the same three; the next Monday may draw others.
    const week = [8, 9, 10, 11, 12, 13].map((d) =>
      slugs(
        base({
          now: new Date(`2026-12-${String(d).padStart(2, "0")}T12:00:00Z`),
        }),
      ),
    );
    for (const w of week) expect(w).toEqual(week[0]);
    const weeks = new Set(
      [0, 7, 14, 21, 28, 35].map((d) =>
        slugs(base({ now: new Date(Date.UTC(2026, 11, 14 + d, 12)) })).join(),
      ),
    );
    expect(weeks.size).toBeGreaterThan(1);
    // Only ships with a picture are drawn while any has one.
    expect(slugs(base())).not.toContain("bare");
  });
});

describe("a show's day", () => {
  const show = {
    slugs: [
      "galaxy",
      "aurora-mk-ii",
      "skylark",
      "andromeda",
      "taurus",
      "centaurus",
    ],
    limited: ["hull-a"],
  };
  it("leads with its first ship, then the day's limited hulls, the ships in the news, the rest drawn", () => {
    const set = featuredShips(
      base({
        show,
        news: [{ slug: "skylark", published_at: "2026-12-08T16:00:00Z" }],
      }),
    );
    expect(set.theme.kind).toBe("show");
    expect(set.cadence).toBe("daily");
    const picked = set.picks.map((p) => p.ship.slug);
    expect(picked.slice(0, 3)).toEqual(["galaxy", "hull-a", "skylark"]);
    expect(set.picks[1]!.why.kind).toBe("limited");
    expect(picked).toHaveLength(FEATURED_COUNT);
    expect(picked.slice(3).every((s) => show.slugs.includes(s))).toBe(true);
  });
  it("comes before a new patch and the news, and changes with the day", () => {
    const release = {
      version: "4.10.3",
      releasedAt: "2026-12-08T00:00:00Z",
      slugs: ["liberator"],
    };
    expect(featuredShips(base({ show, release })).theme.kind).toBe("show");
    const days = new Set(
      [9, 10, 11, 12, 13, 14].map((d) =>
        slugs(
          base({
            show: { ...show, limited: [] },
            now: new Date(Date.UTC(2026, 11, d, 12)),
          }),
        ).join(),
      ),
    );
    expect(days.size).toBeGreaterThan(1);
  });
  it("fills a short day with ships like its first", () => {
    const set = featuredShips(
      base({ show: { slugs: ["liberator"], limited: [] } }),
    );
    expect(set.picks.map((p) => p.ship.slug).slice(0, 3)).toEqual(
      expect.arrayContaining(["liberator", "valkyrie", "hoplite"]),
    );
    expect(set.picks).toHaveLength(FEATURED_COUNT);
  });
  it("gives way when none of its ships is in the register", () => {
    expect(
      featuredShips(base({ show: { slugs: ["nowhere"], limited: [] } })).theme
        .kind,
    ).toBe("week");
  });
});

describe("a new LIVE patch", () => {
  const release = {
    version: "4.10.3",
    releasedAt: "2026-12-08T00:00:00Z",
    slugs: ["liberator", "galaxy"],
  };
  it("leads with its new ships for its first week, the ones in the news first, with ships like them", () => {
    const set = featuredShips(
      base({
        release,
        news: [{ slug: "galaxy", published_at: "2026-12-08T16:00:00Z" }],
      }),
    );
    expect(set.theme).toEqual({ kind: "release", version: "4.10.3" });
    expect(set.cadence).toBe("daily");
    const picked = set.picks.map((p) => p.ship.slug);
    expect(picked.slice(0, 2)).toEqual(["galaxy", "liberator"]);
    expect(set.picks[0]!.why).toEqual({ kind: "new", version: "4.10.3" });
    // The Liberator's fellow dropships before anything else.
    expect(picked.slice(2, 4).sort()).toEqual(["hoplite", "valkyrie"]);
    expect(set.picks[2]!.why).toEqual({ kind: "like", of: "Liberator" });
  });
  it("holds for seven days from the release, then gives way", () => {
    const at = (iso: string) =>
      featuredShips(base({ release, now: new Date(iso) })).theme.kind;
    expect(at("2026-12-07T23:59:00Z")).toBe("week");
    expect(at("2026-12-08T00:00:00Z")).toBe("release");
    expect(at("2026-12-14T23:59:00Z")).toBe("release");
    expect(at("2026-12-15T00:00:00Z")).toBe("week");
    expect(RELEASE_DAYS).toBe(7);
  });
});

describe("a ship in the news", () => {
  it("leads for seven days from the post, the newest post first", () => {
    const news = [
      { slug: "skylark", published_at: "2026-12-03T16:00:00Z" },
      { slug: "centaurus", published_at: "2026-12-05T16:00:00Z" },
    ];
    const set = featuredShips(base({ news }));
    expect(set.theme.kind).toBe("news");
    expect(set.picks.map((p) => p.ship.slug).slice(0, 2)).toEqual([
      "centaurus",
      "skylark",
    ]);
    // The Centaurus brings its line, the Skylark its fellow snub fighter.
    const why = set.picks.slice(2).map((p) => p.why);
    expect(why).toContainEqual({ kind: "line", of: "Constellation" });
    expect(why).toContainEqual({ kind: "like", of: "Skylark" });
    const at = (iso: string) =>
      featuredShips(base({ news, now: new Date(iso) })).theme.kind;
    expect(at("2026-12-10T15:59:00Z")).toBe("news");
    expect(at("2026-12-12T16:00:00Z")).toBe("week");
    // A post after the moment is not news yet.
    expect(at("2026-12-03T15:59:00Z")).toBe("week");
    expect(NEWS_DAYS).toBe(7);
  });
});

describe("companions", () => {
  it("takes a lead's line, then its very role, then its kind, then its maker", () => {
    const lead = SHIPS.find((s) => s.slug === "skylark")!;
    const picks = companions([lead], SHIPS, 1, 20);
    const kinds = picks.map((p) => p.ship.slug);
    expect(kinds[0]).toBe("fury");
    // Fighters of any size next, then RSI's other ships.
    expect(kinds.slice(1, 4).sort()).toEqual(["arrow", "aurora", "gladius"]);
    expect(kinds.slice(4)).toEqual(
      expect.arrayContaining(["perseus", "galaxy", "andromeda"]),
    );
    expect(picks.at(-1)!.why.kind).toBe("maker");
  });
});

describe("shipsNamedIn", () => {
  const named = [
    {
      slug: "galaxy",
      name: "Galaxy",
      makers: makerWords("RSI", "Roberts Space Industries"),
    },
    {
      slug: "aurora",
      name: "Aurora",
      makers: makerWords("RSI", "Roberts Space Industries"),
    },
    {
      slug: "aurora-mk-ii",
      name: "Aurora Mk II",
      makers: makerWords("RSI", "Roberts Space Industries"),
    },
    {
      slug: "andromeda",
      name: "Constellation Mk IV Andromeda",
      makers: makerWords("RSI", "Roberts Space Industries"),
    },
    {
      slug: "sabre-raven-ex",
      name: "Sabre Raven EX",
      makers: makerWords("AEGS", "Aegis Dynamics"),
    },
    {
      slug: "atls-ikti",
      name: "ATLS IKTI",
      makers: makerWords("ARGO", "Argo Astronautics"),
    },
  ];
  it("finds a ship by its maker and whole name", () => {
    expect(shipsNamedIn("RSI Galaxy - Mission Made", named)).toEqual([
      "galaxy",
    ]);
    expect(
      shipsNamedIn("Star Citizen | Behind the Ships: RSI Galaxy", named),
    ).toEqual(["galaxy"]);
    expect(
      shipsNamedIn("Q&A: Aegis Sabre Raven EX and Argo ATLS IKTI Akuma", named),
    ).toEqual(["sabre-raven-ex", "atls-ikti"]);
    expect(
      shipsNamedIn("Roberts Space Industries Galaxy, at last", named),
    ).toEqual(["galaxy"]);
  });
  it("names none in passing or in part", () => {
    expect(shipsNamedIn("Across the galaxy", named)).toEqual([]);
    expect(shipsNamedIn("The Galaxy arrives", named)).toEqual([]);
    expect(shipsNamedIn("RSI Constellation Mk IV Celebration", named)).toEqual(
      [],
    );
    expect(shipsNamedIn("RSI Galaxys", named)).toEqual([]);
  });
  it("reads the longer of two names that overlap", () => {
    expect(shipsNamedIn("Meet the RSI Aurora Mk II", named)).toEqual([
      "aurora-mk-ii",
    ]);
    expect(shipsNamedIn("RSI Aurora and RSI Aurora Mk II", named)).toEqual([
      "aurora",
      "aurora-mk-ii",
    ]);
  });
});

describe("newShips", () => {
  it("takes the records that bring a name, not a new record of a name already there", () => {
    const before = {
      DRAK_Caterpillar: { name: "Caterpillar", manufacturer: "DRAK" },
      AEGS_Hammerhead: { name: "Hammerhead", manufacturer: "AEGS" },
    };
    const after = {
      DRAK_Caterpillar: { name: "Caterpillar", manufacturer: "DRAK" },
      DRAK_Caterpillar_Boarded: { name: "Caterpillar", manufacturer: "DRAK" },
      RSI_Galaxy: { name: "Galaxy", manufacturer: "RSI" },
      RSI_Galaxy_TEMP_Cargo: { name: "Galaxy", manufacturer: "RSI" },
    };
    expect(newShips(before, after)).toEqual([
      "RSI_Galaxy",
      "RSI_Galaxy_TEMP_Cargo",
    ]);
  });
  it("finds the Galaxy and the Liberator in 4.10.3, and not its second Caterpillar", () => {
    const from = snapshotOf("4.10.2-LIVE.12881860");
    const to = snapshotOf("4.10.3-LIVE.13165946");
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    const found = newShips(from!.ships, to!.ships);
    expect(found).toEqual(
      expect.arrayContaining(["RSI_Galaxy", "ANVL_Liberator"]),
    );
    expect(found).not.toContain("DRAK_Caterpillar_Boarded_ShatteredBlade");
  });
});

describe("the pack's sources", () => {
  const frozen = EventRecord.parse(
    JSON.parse(
      readFileSync(
        join(
          REPO_ROOT,
          "fixtures",
          "events",
          "samples",
          "iae-2956.record.json",
        ),
        "utf8",
      ),
    ),
  );
  it("leads a show's day with the ship its banner names, as the hero does", () => {
    const r = repo();
    const resolve = shipResolver(r);
    const day1 = frozen.days[0]!;
    const banner = day1.ships.find((s) => s.name === day1.featured)!;
    const first = showInput(frozen, new Date("2026-11-13T18:00:00Z"), r);
    expect(first).not.toBeNull();
    expect(first!.slugs[0]).toBe(resolve(banner).slug);
    expect(first!.slugs.length).toBeGreaterThan(5);
    expect(new Set(first!.slugs).size).toBeLessThanOrEqual(first!.slugs.length);
    // Outside a show, none.
    expect(showInput(null, new Date("2026-12-09T10:00:00Z"), r)).toBeNull();
  });
  it("gives a day without a list the whole show's ships, its banner's first", () => {
    const r = repo();
    const best = frozen.days.find(
      (d) => d.ships.length === 0 && d.featured !== null,
    )!;
    const at = new Date(`${best.from}T18:00:00Z`);
    const input = showInput(frozen, at, r);
    expect(input).not.toBeNull();
    const banner = frozen.days
      .flatMap((d) => d.ships)
      .find((s) => s.name === best.featured)!;
    expect(input!.slugs[0]).toBe(shipResolver(r)(banner).slug);
  });
  it("reads ships from CIG's titles, never a summary", () => {
    const r = {
      entries: [
        {
          vehicle: { slug: "galaxy", name: "Galaxy", manufacturer_code: "RSI" },
        },
        {
          vehicle: {
            slug: "skylark",
            name: "Skylark",
            manufacturer_code: "RSI",
          },
        },
      ],
      manufacturers: [{ code: "RSI", name: "Roberts Space Industries" }],
      dispatches: [
        {
          source: "comm_link",
          title: "RSI Galaxy - Mission Made",
          summary: "The RSI Skylark joins it.",
          published_at: "2026-11-13T16:00:00.000Z",
        },
      ],
      videos: [
        {
          source: "video",
          title: "Star Citizen | Behind the Ships: RSI Galaxy",
          summary: null,
          published_at: "2026-11-09T22:00:00.000Z",
        },
      ],
    } as unknown as Parameters<typeof newsMentions>[0];
    expect(newsMentions(r, [])).toEqual([
      { slug: "galaxy", published_at: "2026-11-13T16:00:00.000Z" },
      { slug: "galaxy", published_at: "2026-11-09T22:00:00.000Z" },
    ]);
  });
});
