import { PortType } from "schema";
import { describe, expect, it } from "vitest";
import { buildRepository, flattenPorts } from "../lib/data";
import {
  type LoadoutEntry,
  allPortTypes,
  headlineStat,
  loadoutGroups,
  portTypeGroups,
  subtypeLabel,
  throughStructure,
} from "../lib/loadout";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Ship page": the stock loadout grouped by system, nested ports kept under
// their parent, each mounted item linked. Checked over every ship in the fixture pack.

const r = buildRepository(bootstrapPack(), []);
const stats = (className: string) =>
  r.componentByClass(className)?.stats ?? null;

const countEntries = (entries: readonly LoadoutEntry[]): number =>
  entries.reduce((n, e) => n + e.count + countEntries(e.children) * e.count, 0);
const allEntries = (entries: readonly LoadoutEntry[]): LoadoutEntry[] =>
  entries.flatMap((e) => [e, ...allEntries(e.children)]);

describe("loadoutGroups on the fixture pack", () => {
  const perShip = r.ships.map((ship) => ({
    ship,
    roots: r.shipPorts(ship.vehicle.class_name),
    groups: loadoutGroups(r.shipPorts(ship.vehicle.class_name), stats),
  }));

  for (const { ship, roots, groups } of perShip) {
    it(`${ship.vehicle.name}: accounts for every listed port once`, () => {
      // Listed: every port that is not a structural `other` with nothing mounted, at any depth;
      // a structural parent is transparent, its children count at its level.
      const listed = (nodes: typeof roots): number =>
        throughStructure(nodes).reduce(
          (n, node) => n + 1 + listed(node.children),
          0,
        );
      expect(groups.reduce((n, g) => n + countEntries(g.entries), 0)).toBe(
        listed(roots),
      );
      expect(groups.reduce((n, g) => n + g.ports, 0)).toBe(listed(roots));
    });

    it(`${ship.vehicle.name}: keeps nested items under their mount and links every mounted part`, () => {
      for (const group of groups) {
        const keys = group.entries.map((e) => e.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const entry of allEntries(group.entries)) {
          expect(entry.count).toBeGreaterThan(0);
          if (entry.item !== null) {
            expect(entry.item.slug).toMatch(/^[a-z0-9-]+$/);
            expect(entry.classes).toContain(entry.item.class_name);
          } else {
            expect(entry.classes).toEqual([]);
          }
        }
      }
      const anyNested = flattenPorts(roots).some(
        ({ node }) =>
          node.port.port_type !== "other" &&
          throughStructure(node.children).some((c) => c.item !== null),
      );
      if (anyNested) {
        expect(
          groups.flatMap((g) => g.entries).some((e) => e.children.length > 0),
        ).toBe(true);
      }
    });

    it(`${ship.vehicle.name}: lists mounted items before empty ports and omits empty groups`, () => {
      for (const group of groups) {
        expect(group.entries.length).toBeGreaterThan(0);
        const firstEmpty = group.entries.findIndex((e) => e.item === null);
        if (firstEmpty >= 0) {
          for (const entry of group.entries.slice(firstEmpty)) {
            expect(entry.item).toBeNull();
          }
        }
      }
    });
  }

  it("merges sibling ports that carry the same part, and only those", () => {
    // The pack has ships with two of the same cooler, so at least one entry merges.
    const merged = perShip.flatMap(({ groups }) =>
      groups.flatMap((g) => allEntries(g.entries)).filter((e) => e.count > 1),
    );
    expect(merged.length).toBeGreaterThan(0);
    for (const entry of merged) {
      // Every class a merged entry stands for shares the part's name, type, size and subtype.
      for (const cls of entry.classes) {
        const item = r.componentByClass(cls)?.item;
        expect(item?.name).toBe(entry.item?.name);
        expect(item?.type).toBe(entry.item?.type);
        expect(item?.size).toBe(entry.item?.size);
        expect(item?.subtype ?? "").toBe(entry.item?.subtype ?? "");
      }
    }
  });

  it("keeps same-named parts with different subtypes apart and marks them", () => {
    // A hydrogen and a quantum tank both called the same thing must stay two entries.
    for (const { groups } of perShip) {
      for (const group of groups) {
        const byName = new Map<string, LoadoutEntry[]>();
        for (const e of group.entries) {
          if (e.item === null) continue;
          byName.set(e.item.name, [...(byName.get(e.item.name) ?? []), e]);
        }
        for (const entries of byName.values()) {
          if (entries.length < 2) continue;
          // Each is marked, and each differs from the others in subtype, size range or what it carries.
          for (const e of entries) expect(e.showSubtype).toBe(true);
          const signatures = entries.map(
            (e) =>
              `${e.item?.subtype ?? ""}|${e.sizeMin}-${e.sizeMax}|${e.children.map((c) => c.key).join(",")}`,
          );
          expect(new Set(signatures).size).toBe(entries.length);
        }
      }
    }
  });

  it("gives every port type a panel", () => {
    for (const type of PortType.options) {
      expect(portTypeGroups[type]).toBeDefined();
    }
    expect(allPortTypes).toEqual(PortType.options);
  });
});

describe("subtypeLabel", () => {
  it("splits CamelCase into sentence case", () => {
    expect(subtypeLabel("QuantumFuel")).toBe("Quantum fuel");
    expect(subtypeLabel("Fuel")).toBe("Fuel");
    expect(subtypeLabel("GunTurret")).toBe("Gun turret");
  });
});

describe("headlineStat", () => {
  it("shows a weapon's damage and a shield's health when the pack has them, nothing otherwise", () => {
    const weapon = r.components.find(
      (c) => c.item.type === "weapon" && c.stats?.weapon_damage != null,
    );
    expect(weapon, "pack has a weapon with damage").toBeDefined();
    if (weapon !== undefined) {
      expect(headlineStat(weapon.item, weapon.stats)).toEqual({
        value: weapon.stats?.weapon_damage,
        label: "damage",
      });
    }
    const shield = r.components.find(
      (c) => c.item.type === "shield" && c.stats?.shield_hp != null,
    );
    expect(shield, "pack has a shield with health").toBeDefined();
    if (shield !== undefined) {
      expect(headlineStat(shield.item, shield.stats)?.label).toBe("shield HP");
    }
    const armor = r.components.find((c) => c.item.type === "armor");
    expect(armor, "pack has an armor item").toBeDefined();
    if (armor !== undefined) {
      expect(headlineStat(armor.item, armor.stats)).toBeNull();
    }
    const any = r.components[0];
    if (any !== undefined) expect(headlineStat(any.item, null)).toBeNull();
  });
});
