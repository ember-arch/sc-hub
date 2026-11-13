import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { type PatchSnapshot, PatchSnapshotFile, decodeSnapshot } from "schema";
import { describe, expect, it } from "vitest";
import { changeOf, formatValue, topChanges } from "../lib/patch-format";
import type { PatchNote } from "../lib/patch-notes";
import {
  PATCHES_DIR,
  buildLabel,
  builds,
  buildsOf,
  compareSnapshots,
  compareVersions,
  notesBetween,
  parseCode,
  previousOf,
  ptuInTesting,
  releasedAhead,
  shipMentions,
  totals,
} from "../lib/patches";

// The patch pages' comparison (ADR-049), on synthetic snapshots so every rule is pinned: what
// counts as changed, added, removed or simply not recorded; loadouts; blueprints; families.

function snapshot(
  code: string,
  rows: Partial<
    Pick<PatchSnapshot, "ships" | "parts" | "blueprints" | "unrecorded_ships">
  >,
  released = "2026-10-09T00:00:00.000Z",
): PatchSnapshot {
  const ships = rows.ships ?? {};
  const parts = rows.parts ?? {};
  const blueprints = rows.blueprints ?? {};
  return {
    schema_version: 2,
    game_version: code,
    channel: "LIVE",
    released_at: released,
    fetched_at: "2026-11-11T00:00:00.000Z",
    source: "wiki-api",
    source_url: "https://api.star-citizen.wiki",
    counts: {
      ships: Object.keys(ships).length,
      parts: Object.keys(parts).length,
      blueprints: Object.keys(blueprints).length,
    },
    ships,
    unrecorded_ships: rows.unrecorded_ships ?? [],
    parts,
    blueprints,
  };
}

const ship = (
  name: string,
  figures: Record<string, number | string | boolean>,
  loadout: Record<string, string> = {},
) => ({
  name,
  game_name: `Aegis ${name}`,
  manufacturer: "AEGS",
  figures,
  loadout,
});

const gun = (
  name: string,
  figures: Record<string, number | string | boolean>,
) => ({
  name,
  type: "WeaponGun",
  sub_type: "Gun",
  size: 3,
  grade: "A",
  manufacturer: "BEHR",
  figures,
});

describe("parseCode and compareVersions", () => {
  it("reads a build string and orders versions as numbers", () => {
    expect(parseCode("4.10.2-LIVE.12881860")).toEqual({
      version: "4.10.2",
      channel: "LIVE",
      number: "12881860",
    });
    expect(parseCode("not a build")).toBeNull();
    expect(compareVersions("4.9.0", "4.10.0")).toBeLessThan(0);
    expect(compareVersions("4.10.2", "4.10.2")).toBe(0);
  });
});

describe("buildsOf", () => {
  const ordered = (codes: string[]) =>
    buildsOf(
      codes
        .map((c) => snapshot(c, {}))
        .sort(
          (a, b) =>
            Number(a.game_version.split(".").at(-1)) -
            Number(b.game_version.split(".").at(-1)),
        ),
    );

  it("gives the first build of a version the plain address and a later one its number", () => {
    const list = ordered([
      "4.5.0-LIVE.10966564",
      "4.6.0-LIVE.11135423",
      "4.6.0-LIVE.11218823",
    ]);
    expect(list.map((b) => b.slug)).toEqual([
      "4.5.0",
      "4.6.0",
      "4.6.0-11218823",
    ]);
    expect(previousOf(list[2]!, list)?.code).toBe("4.6.0-LIVE.11135423");
    expect(previousOf(list[0]!, list)).toBeNull();
  });

  it("never moves an address when a hotfix of the same version lands", () => {
    const before = ordered(["4.10.1-LIVE.12660092", "4.10.2-LIVE.12881860"]);
    const after = ordered([
      "4.10.1-LIVE.12660092",
      "4.10.2-LIVE.12881860",
      "4.10.2-LIVE.12913470",
    ]);
    for (const b of before) {
      expect(after.find((a) => a.code === b.code)?.slug).toBe(b.slug);
    }
    expect(after.at(-1)?.slug).toBe("4.10.2-12913470");
    expect(buildLabel(after[2]!, after[1]!)).toBe("4.10.2 (12913470)");
    expect(buildLabel(after[1]!, after[0]!)).toBe("4.10.2");
  });
});

describe("ships a build lists without figures", () => {
  it("are neither new nor removed", () => {
    const a = snapshot("4.8.0-LIVE.1", {
      ships: {
        A: ship("A", { "speed.scm": 1 }),
        B: ship("B", { "speed.scm": 1 }),
      },
    });
    const b = snapshot("4.8.1-LIVE.2", {
      ships: {
        A: ship("A", { "speed.scm": 1 }),
        C: ship("C", { "speed.scm": 1 }),
      },
      unrecorded_ships: ["B"],
    });
    const c = compareSnapshots(a, b);
    expect(c.ships.removed).toEqual([]);
    expect(c.ships.added.map((s) => s.id)).toEqual(["C"]);
    expect(c.uncompared).toBe(1);
    const back = compareSnapshots(
      snapshot("1.0.0-LIVE.1", { ships: {}, unrecorded_ships: ["C"] }),
      b,
    );
    expect(back.ships.added.map((s) => s.id)).toEqual(["A"]);
    expect(back.uncompared).toBe(1);
  });
});

describe("what a build states", () => {
  it("shows a figure as new when the other build states it for another entry of the kind", () => {
    const a = snapshot("4.10.1-LIVE.1", {
      ships: {
        A: ship("A", { "speed.scm": 100 }),
        B: ship("B", { "speed.scm": 100, "emission.ir": 500 }),
      },
    });
    const b = snapshot("4.10.2-LIVE.2", {
      ships: {
        A: ship("A", { "speed.scm": 100, "emission.ir": 700 }),
        B: ship("B", { "speed.scm": 100, "emission.ir": 500 }),
      },
    });
    const c = compareSnapshots(a, b);
    expect(
      c.ships.changed[0]?.figures.map((f) => [f.key, f.from, f.to]),
    ).toEqual([["emission.ir", null, 700]]);
    expect(c.unrecorded).toBe(0);
  });

  it("judges a part's figures by what parts of its own type state", () => {
    const shield = {
      name: "S",
      type: "Shield",
      sub_type: null,
      size: 1,
      grade: "A",
      manufacturer: null,
      figures: { "durability.health": 10 } as Record<string, number>,
    };
    const a = snapshot("4.10.1-LIVE.1", {
      parts: {
        G: gun("G", { "vehicle_weapon.rpm": 600, "emission.em_max": 40 }),
        S: shield,
      },
    });
    const b = snapshot("4.10.2-LIVE.2", {
      parts: {
        G: gun("G", { "vehicle_weapon.rpm": 600, "emission.em_max": 40 }),
        S: {
          ...shield,
          figures: { "durability.health": 10, "emission.em_max": 90 },
        },
      },
    });
    // Only a gun stated an EM figure in 4.10.1; for shields the source did not record it then.
    const c = compareSnapshots(a, b);
    expect(c.parts).toEqual([]);
    expect(c.unrecorded).toBe(1);
  });
});

describe("compareSnapshots", () => {
  const from = snapshot("4.10.1-LIVE.12660092", {
    ships: {
      AEGS_Gladius: ship(
        "Gladius",
        { "speed.scm": 220, health: 6110, role: "Light Fighter" },
        { hardpoint_weapon_wing_left: "BEHR_LaserRepeater_S3" },
      ),
      AEGS_Old: ship("Old", { "speed.scm": 100 }),
      AEGS_Same: ship("Same", { "speed.scm": 150 }),
    },
    parts: {
      BEHR_LaserRepeater_S3: gun("Attrition-3", {
        "vehicle_weapon.damage.burst": 300,
        "vehicle_weapon.rpm": 600,
      }),
    },
    blueprints: {
      BP_A: {
        output_name: "Attrition-3",
        output_class: "behr_laserrepeater_s3",
        figures: { craft_time_seconds: 540 },
        ingredients: { Agricium: { amount: 0.36, unit: "SCU" } },
      },
    },
  });
  const to = snapshot("4.10.2-LIVE.12881860", {
    ships: {
      AEGS_Gladius: ship(
        "Gladius",
        {
          "speed.scm": 226,
          health: 6110,
          role: "Light Fighter",
          // Stated by no ship in 4.10.1: the source did not record it then.
          "emission.ir": 8711,
        },
        { hardpoint_weapon_wing_left: "BEHR_LaserRepeater_S3_New" },
      ),
      AEGS_New: ship("New", { "speed.scm": 300, "crew.max": 2 }),
      AEGS_Same: ship("Same", { "speed.scm": 150 }),
    },
    parts: {
      BEHR_LaserRepeater_S3: gun("Attrition-3", {
        "vehicle_weapon.damage.burst": 320,
        "vehicle_weapon.rpm": 600,
      }),
      BEHR_LaserRepeater_S3_New: gun("Attrition-3 Mk2", {
        "vehicle_weapon.damage.burst": 330,
      }),
    },
    blueprints: {
      BP_A: {
        output_name: "Attrition-3",
        output_class: "behr_laserrepeater_s3",
        figures: { craft_time_seconds: 480 },
        ingredients: {
          Agricium: { amount: 0.4, unit: "SCU" },
          Hadanite: { amount: 7, unit: "each" },
        },
      },
    },
  });
  const c = compareSnapshots(from, to, {
    maker: (code) => (code === "BEHR" ? "Behring" : null),
    ship: (cls) => (cls === "AEGS_Gladius" ? "/ships/aegs-gladius" : null),
    part: (cls) =>
      cls.toLowerCase() === "behr_laserrepeater_s3"
        ? {
            className: "BEHR_LaserRepeater_S3",
            name: "Attrition-3",
            href: "/components/behr-attrition-3",
          }
        : null,
  });

  it("lists a ship as changed only by the figures both builds state, and counts the rest", () => {
    const gladius = c.ships.changed.find((s) => s.id === "AEGS_Gladius");
    expect(gladius?.href).toBe("/ships/aegs-gladius");
    expect(gladius?.figures.map((f) => [f.key, f.from, f.to])).toEqual([
      ["speed.scm", 220, 226],
    ]);
    expect(c.unrecorded).toBe(1);
    expect(c.ships.changed.some((s) => s.id === "AEGS_Same")).toBe(false);
  });

  it("lists the refitted port with both parts, linked where the pack lists them", () => {
    const gladius = c.ships.changed.find((s) => s.id === "AEGS_Gladius");
    expect(gladius?.loadout).toEqual([
      {
        port: "hardpoint_weapon_wing_left",
        place: "Wing left",
        from: {
          className: "BEHR_LaserRepeater_S3",
          name: "Attrition-3",
          href: "/components/behr-attrition-3",
        },
        to: {
          className: "BEHR_LaserRepeater_S3_New",
          name: "Attrition-3 Mk2",
          href: null,
        },
      },
    ]);
  });

  it("introduces new and removed ships by their headline figures", () => {
    expect(c.ships.added.map((s) => s.id)).toEqual(["AEGS_New"]);
    expect(c.ships.added[0]?.figures.map((f) => [f.key, f.from, f.to])).toEqual(
      [
        ["speed.scm", null, 300],
        ["crew.max", null, 2],
      ],
    );
    expect(c.ships.removed.map((s) => s.id)).toEqual(["AEGS_Old"]);
    expect(c.ships.removed[0]?.figures[0]?.from).toBe(100);
  });

  it("files parts under their family", () => {
    expect(c.parts.map((f) => f.id)).toEqual(["guns"]);
    const guns = c.parts[0]!;
    expect(guns.changed.map((p) => p.figures.map((f) => f.label))).toEqual([
      ["Damage per second"],
    ]);
    expect(guns.added.map((p) => p.id)).toEqual(["BEHR_LaserRepeater_S3_New"]);
    expect(guns.changed[0]?.detail).toBe("Size 3 · Grade A · Behring");
  });

  it("compares blueprints by figure and ingredient, linking the part they make", () => {
    const bp = c.blueprints.changed[0];
    expect(bp?.href).toBe("/components/behr-attrition-3");
    expect(bp?.figures.map((f) => [f.label, f.from, f.to])).toEqual([
      ["Craft time", 540, 480],
    ]);
    expect(bp?.ingredients).toEqual([
      {
        name: "Agricium",
        from: { amount: 0.36, unit: "SCU" },
        to: { amount: 0.4, unit: "SCU" },
      },
      { name: "Hadanite", from: null, to: { amount: 7, unit: "each" } },
    ]);
  });

  it("totals the entries by block", () => {
    expect(totals(c)).toEqual({ ships: 3, parts: 2, blueprints: 1 });
  });
});

describe("shipMentions", () => {
  const note: PatchNote = {
    id: "n1",
    kind: "ptu",
    title: "[Wave 1] Star Citizen Alpha 4.10.3 PTU Patch Notes 12999338",
    url: "https://robertsspaceindustries.com/spectrum/community/SC/forum/190048/thread/x",
    publishedAt: "2026-10-23T00:00:00.000Z",
    version: "4.10.3",
    channel: "PTU",
    build: "12999338",
    audience: "Wave 1",
    releaseCandidate: null,
    hotfix: false,
    facts: [],
    sections: [
      {
        title: "Bug Fixes",
        groups: [
          {
            title: null,
            items: [
              "Potential Fix: Drake Cutlass Black ramp raised when lowering",
              "Potential Fix: Gladius decals missing",
              "Potential Fix: The Golem missing its audio alert",
              "Added a cargo door interaction to the Esperia Prowler Utility",
              "aUEC increases for the Drake Ironclad, Drake Ironclad Assault",
            ],
          },
        ],
      },
    ],
    flat: false,
    summary: "",
  };
  const m = shipMentions(
    [note],
    [
      {
        id: "DRAK_Cutlass_Black",
        name: "Cutlass Black",
        gameName: "Drake Cutlass Black",
      },
      { id: "AEGS_Gladius", name: "Gladius", gameName: "Aegis Gladius" },
      { id: "DRAK_Golem", name: "Golem", gameName: "Drake Golem" },
      { id: "ESPR_Prowler", name: "Prowler", gameName: "Esperia Prowler" },
      {
        id: "ESPR_Prowler_Utility",
        name: "Prowler Utility",
        gameName: "Esperia Prowler Utility",
      },
      { id: "DRAK_Ironclad", name: "Ironclad", gameName: "Drake Ironclad" },
      {
        id: "DRAK_Ironclad_Assault",
        name: "Ironclad Assault",
        gameName: "Drake Ironclad Assault",
      },
    ],
  );

  it("gives a line to the longer name it holds, and to a shorter one only where it stands alone", () => {
    expect(m.has("ESPR_Prowler")).toBe(false);
    expect(m.get("ESPR_Prowler_Utility")).toHaveLength(1);
    expect(m.get("DRAK_Ironclad")).toHaveLength(1);
    expect(m.get("DRAK_Ironclad_Assault")).toHaveLength(1);
  });

  it("matches the full in-game name or a name of two words, never a single word", () => {
    expect(m.get("DRAK_Cutlass_Black")?.map((x) => x.text)).toEqual([
      "Potential Fix: Drake Cutlass Black ramp raised when lowering",
    ]);
    expect(m.has("AEGS_Gladius")).toBe(false);
    expect(m.has("DRAK_Golem")).toBe(false);
  });
});

describe("notesBetween", () => {
  const n = (version: string) => ({ version }) as PatchNote;
  it("takes every version after the old build up to and including the new one", () => {
    const notes = ["4.8.2", "4.8.3", "4.9.0", "4.10.0"].map(n);
    expect(notesBetween(notes, "4.8.2", "4.9.0").map((x) => x.version)).toEqual(
      ["4.8.3", "4.9.0"],
    );
  });
});

describe("patch-format", () => {
  it("writes figures as stated and changes with an arrow and a share", () => {
    expect(formatValue(0.036064)).toBe("0.036064");
    expect(formatValue(190000000)).toBe("190,000,000");
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(null)).toBe("—");
    expect(changeOf(220, 226)).toMatchObject({
      text: "↑ 6",
      percent: "+2.7%",
      direction: "up",
    });
    expect(changeOf(0.3, 0.1).text).toBe("↓ 0.2");
    expect(changeOf(null, 5).text).toBe("New");
    expect(changeOf("IR", "EM").text).toBe("Changed");
  });

  it("puts the changes that moved most first", () => {
    const f = (key: string, from: number, to: number) => ({
      key,
      label: key,
      group: "Flight",
      from,
      to,
    });
    expect(
      topChanges([f("a", 100, 101), f("b", 10, 20), f("c", 50, 40)], 2).map(
        (x) => x.key,
      ),
    ).toEqual(["b", "c"]);
  });
});

/**
 * Folders whose pictures, models and media are copied locally and git-ignored (ADR-009); only a
 * README and a sources list of each is committed, so they are not part of the fixtures' size.
 */
const LOCAL_ONLY = new Set([
  "fankit",
  "galleries",
  "holo",
  "rsi-media",
  "showcase",
  "spectrum-media",
  "titles-media",
]);

describe("the snapshots on record", () => {
  const files = readdirSync(PATCHES_DIR).filter((f) =>
    /^\d.*\.json\.gz$/.test(f),
  );

  it("are each named by their build, parse, and stay under 400 kB gzipped", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const path = join(PATCHES_DIR, f);
      expect(statSync(path).size, f).toBeLessThan(400 * 1024);
      const s = decodeSnapshot(
        PatchSnapshotFile.parse(
          JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")),
        ),
      );
      expect(`${s.game_version}.json.gz`).toBe(f);
      expect(s.counts.ships).toBe(Object.keys(s.ships).length);
      expect(s.counts.parts).toBe(Object.keys(s.parts).length);
      expect(s.counts.blueprints).toBe(Object.keys(s.blueprints).length);
    }
  });

  it("keep fixtures/ under the 40 MB CLAUDE.md section 4 sets", () => {
    const size = (dir: string): number =>
      readdirSync(dir, { withFileTypes: true }).reduce(
        (n, e) =>
          n +
          (e.isDirectory()
            ? size(join(dir, e.name))
            : statSync(join(dir, e.name)).size),
        0,
      );
    // Git-ignored media folders hold local copies only; they are not committed.
    const committed = readdirSync(join(PATCHES_DIR, ".."), {
      withFileTypes: true,
    })
      .filter((e) => e.isDirectory() && !LOCAL_ONLY.has(e.name))
      .reduce((n, e) => n + size(join(PATCHES_DIR, "..", e.name)), 0);
    expect(committed).toBeLessThan(40 * 1024 * 1024);
  });

  it("give each build one address", () => {
    const list = builds();
    expect(new Set(list.map((b) => b.slug)).size).toBe(list.length);
  });
});

describe("ptuInTesting", () => {
  // The patch pages' "PTU in testing" (ADR-049, ADR-046), from the newest post down.
  const post = (
    version: string,
    channel: "LIVE" | "PTU",
    audience: string | null = null,
    kind: PatchNote["kind"] = channel === "LIVE" ? "live" : "ptu",
  ) =>
    ({
      version,
      channel,
      audience,
      kind,
      title: `${audience === null ? "" : `[${audience}] `}Star Citizen Alpha ${version} ${channel} Patch Notes`,
    }) as PatchNote;

  it("names the newest PTU version ahead of LIVE, with only that version's posts", () => {
    const notes = [
      post("4.10.3", "PTU", "All Waves"),
      post("4.10.3", "PTU", "Wave 1"),
      post("4.10.2", "PTU"),
    ];
    expect(ptuInTesting(notes, "4.10.2").map((n) => n.audience)).toEqual([
      "All Waves",
      "Wave 1",
    ]);
  });

  it("drops a version CIG has put out on LIVE, though the wiki's build still lags", () => {
    const notes = [post("4.10.3", "LIVE"), post("4.10.3", "PTU", "All Waves")];
    expect(ptuInTesting(notes, "4.10.2")).toEqual([]);
  });

  it("leaves out a test CIG has closed, so a closed preview never reads as in testing", () => {
    const notes = [post("5.0.0", "PTU", "Now Closed"), post("4.10.3", "LIVE")];
    expect(ptuInTesting(notes, "4.10.3")).toEqual([]);
    expect(
      ptuInTesting(
        [post("5.0.0", "PTU", "Now Closed"), post("4.10.4", "PTU", "Wave 1")],
        "4.10.3",
      ).map((n) => n.version),
    ).toEqual(["4.10.4"]);
  });

  it("keeps a PTU whose version only has a Comm-Link announcement, which comes before release", () => {
    const notes = [
      post("4.11.0", "LIVE", null, "announcement"),
      post("4.11.0", "PTU", "Wave 1"),
    ];
    expect(ptuInTesting(notes, "4.10.3").map((n) => n.version)).toEqual([
      "4.11.0",
    ]);
  });

  it("closes a whole version when any of its posts says closed", () => {
    const notes = [
      post("5.0.0", "PTU", "Now Closed"),
      post("5.0.0", "PTU", "Evocati"),
    ];
    expect(ptuInTesting(notes, "4.10.3")).toEqual([]);
  });

  it("names nothing when every PTU post is at or behind LIVE", () => {
    expect(ptuInTesting([post("4.10.2", "PTU")], "4.10.2")).toEqual([]);
  });
});

describe("releasedAhead", () => {
  // A version CIG has put out on LIVE before the wiki publishes its figures (ADR-049, amended).
  const post = (
    version: string,
    channel: "LIVE" | "PTU",
    publishedAt: string,
    kind: PatchNote["kind"] = channel === "LIVE" ? "live" : "ptu",
  ) =>
    ({
      version,
      channel,
      kind,
      publishedAt,
      title: `Star Citizen Alpha ${version} ${channel} Notes`,
    }) as PatchNote;

  it("names the newest version CIG released on LIVE ahead of the figures, with its notes", () => {
    const notes = [
      post("4.10.3", "LIVE", "2026-11-12T17:17:00Z", "announcement"),
      post("4.10.3", "LIVE", "2026-11-12T15:17:47Z"),
      post("4.10.3", "PTU", "2026-11-10T21:32:16Z"),
      post("4.10.2", "LIVE", "2026-10-09T00:00:00Z"),
    ];
    const ahead = releasedAhead(notes, "4.10.2");
    expect(ahead?.version).toBe("4.10.3");
    // Released when its release notes went up, not when RSI announced it.
    expect(ahead?.releasedAt).toBe("2026-11-12T15:17:47Z");
    expect(ahead?.notes.map((n) => n.kind)).toEqual([
      "announcement",
      "live",
      "ptu",
    ]);
  });

  it("is nothing while the figures on record are as new as CIG's latest release", () => {
    const notes = [post("4.10.3", "LIVE", "2026-11-12T15:17:47Z")];
    expect(releasedAhead(notes, "4.10.3")).toBeNull();
    expect(releasedAhead(notes, null)).toBeNull();
  });

  it("takes neither an announcement nor a PTU as a release", () => {
    const notes = [
      post("4.11.0", "LIVE", "2026-12-01T17:00:00Z", "announcement"),
      post("4.11.0", "PTU", "2026-11-28T17:00:00Z"),
    ];
    expect(releasedAhead(notes, "4.10.3")).toBeNull();
  });

  it("takes the newest of two releases ahead, a hotfix counting as one", () => {
    const notes = [
      post("4.10.4", "LIVE", "2026-11-20T15:00:00Z", "hotfix"),
      post("4.10.3", "LIVE", "2026-11-12T15:17:47Z"),
    ];
    expect(releasedAhead(notes, "4.10.2")?.version).toBe("4.10.4");
  });
});
