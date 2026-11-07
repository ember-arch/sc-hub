import { describe, expect, it } from "vitest";
import { buildRepository, flattenPorts } from "../lib/data";
import { type LoadoutEntry, headlineStat, loadoutGroups } from "../lib/loadout";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Ship page": the stock loadout grouped by system, nested ports kept under
// their parent, each mounted item linked. Checked over every ship in the fixture pack.

const r = buildRepository(bootstrapPack(), []);
const stats = (className: string) =>
  r.componentByClass(className)?.stats ?? null;

const countEntries = (entries: readonly LoadoutEntry[]): number =>
  entries.reduce((n, e) => n + e.count + countEntries(e.children) * e.count, 0);

describe("loadoutGroups on the fixture pack", () => {
  for (const ship of r.ships) {
    const roots = r.shipPorts(ship.vehicle.class_name);
    const groups = loadoutGroups(roots, stats);

    it(`${ship.vehicle.name}: accounts for every listed port once`, () => {
      // Listed: every port that is not a structural `other` with nothing mounted, at any depth,
      // but only under listed parents (a structural parent hides its children too).
      const listed = (nodes: typeof roots): number =>
        nodes
          .filter((n) => n.port.port_type !== "other" || n.item !== null)
          .reduce((n, node) => n + 1 + listed(node.children), 0);
      expect(groups.reduce((n, g) => n + countEntries(g.entries), 0)).toBe(
        listed(roots),
      );
      expect(groups.reduce((n, g) => n + g.ports, 0)).toBe(listed(roots));
    });

    it(`${ship.vehicle.name}: merges identical ports and keeps nested items under their mount`, () => {
      for (const group of groups) {
        const keys = group.entries.map((e) => e.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const entry of group.entries) {
          expect(entry.count).toBeGreaterThan(0);
          if (entry.item !== null) {
            expect(entry.item.slug).toMatch(/^[a-z0-9-]+$/);
          }
          for (const child of entry.children) {
            expect(child.count).toBeGreaterThan(0);
          }
        }
      }
      const turrets = groups
        .flatMap((g) => g.entries)
        .filter(
          (e) => e.portType === "turret" || e.portType === "missile_rack",
        );
      const anyNested = flattenPorts(roots).some(
        ({ node }) =>
          node.children.length > 0 && node.port.port_type !== "other",
      );
      if (anyNested) {
        expect(turrets.some((t) => t.children.length > 0)).toBe(true);
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
});

describe("headlineStat", () => {
  it("shows a weapon's damage and a shield's health when the pack has them, nothing otherwise", () => {
    const weapon = r.components.find(
      (c) => c.item.type === "weapon" && c.stats?.weapon_damage !== null,
    );
    if (weapon !== undefined) {
      expect(headlineStat(weapon.item, weapon.stats)).toEqual({
        value: weapon.stats?.weapon_damage,
        label: "damage",
      });
    }
    const shield = r.components.find((c) => c.item.type === "shield");
    if (shield !== undefined && shield.stats?.shield_hp != null) {
      expect(headlineStat(shield.item, shield.stats)?.label).toBe("shield HP");
    }
    const armor = r.components.find((c) => c.item.type === "armor");
    if (armor !== undefined) {
      expect(headlineStat(armor.item, armor.stats)).toBeNull();
    }
    const any = r.components[0];
    if (any !== undefined) expect(headlineStat(any.item, null)).toBeNull();
  });
});
