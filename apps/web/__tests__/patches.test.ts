import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { type PatchSnapshot, PatchSnapshotFile, decodeSnapshot } from "schema";
import { describe, expect, it } from "vitest";
import { changeOf, formatValue, topChanges } from "../lib/patch-format";
import type { PatchNote } from "../lib/patch-notes";
import {
  PATCHES_DIR,
  builds,
  buildsOf,
  compareSnapshots,
  compareVersions,
  notesBetween,
  parseCode,
  previousOf,
  shipMentions,
  totals,
} from "../lib/patches";

// The patch pages' comparison (ADR-049), on synthetic snapshots so every rule is pinned: what
// counts as changed, added, removed or simply not recorded; loadouts; blueprints; families.

function snapshot(
  code: string,
  rows: Partial<Pick<PatchSnapshot, "ships" | "parts" | "blueprints">>,
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
  it("orders builds oldest first and gives an earlier build of a shared version its number", () => {
    const list = buildsOf(
      [
        snapshot("4.6.0-LIVE.11218823", {}),
        snapshot("4.5.0-LIVE.10966564", {}),
        snapshot("4.6.0-LIVE.11135423", {}),
      ].sort((a, b) => a.game_version.localeCompare(b.game_version)),
    );
    // buildsOf keeps the order it is handed; snapshots() sorts by release.
    const slugs = list.map((b) => b.slug);
    expect(slugs).toContain("4.5.0");
    expect(slugs).toContain("4.6.0");
    expect(slugs).toContain("4.6.0-11135423");
    const newest = list.find((b) => b.slug === "4.6.0");
    expect(newest?.number).toBe("11218823");
    expect(previousOf(list[2]!, list)?.code).toBe(list[1]!.code);
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

describe("the snapshots on record", () => {
  const files = readdirSync(PATCHES_DIR).filter((f) => /^\d.*\.json$/.test(f));

  it("are each named by their build, parse, and stay under 2.5 MB", () => {
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const path = join(PATCHES_DIR, f);
      expect(statSync(path).size, f).toBeLessThan(2.5 * 1024 * 1024);
      const s = decodeSnapshot(
        PatchSnapshotFile.parse(JSON.parse(readFileSync(path, "utf8"))),
      );
      expect(`${s.game_version}.json`).toBe(f);
      expect(s.counts.ships).toBe(Object.keys(s.ships).length);
      expect(s.counts.parts).toBe(Object.keys(s.parts).length);
      expect(s.counts.blueprints).toBe(Object.keys(s.blueprints).length);
    }
  });

  it("give every LIVE build with one before it a page, the newest at /patches", () => {
    const list = builds();
    const live = list.filter((b) => b.channel === "LIVE");
    expect(new Set(list.map((b) => b.slug)).size).toBe(list.length);
    for (const b of live.slice(1)) expect(previousOf(b, list)).not.toBeNull();
  });
});
