import { describe, expect, it } from "vitest";
import { armament, armamentPlan } from "../lib/armament";
import { buildRepository } from "../lib/data";
import { loadoutGroups } from "../lib/loadout";
import {
  editorModel,
  optionStats,
  optionsFor,
  placeOf,
  totals,
} from "../lib/loadout-editor";
import { bootstrapPack } from "./pack";

// ADR-016: the loadout editor offers, for every swappable port, the parts that fit it by the
// game's own rule (type and size), and adds a build up from the parts' records alone.

const r = buildRepository(bootstrapPack(), []);
const stats = (className: string) =>
  r.componentByClass(className)?.stats ?? null;

describe("placeOf", () => {
  it("keeps the words that say where a port is", () => {
    expect(placeOf("hardpoint_gun_left_wing")).toBe("Left wing");
    expect(placeOf("hardpoint_gun_nose")).toBe("Nose");
    expect(placeOf("hardpoint_missilerack_right_wing_inner")).toBe(
      "Right wing inner",
    );
    expect(placeOf("hardpoint_class_2")).toBeNull();
  });
});

describe("editorModel on the fixture pack", () => {
  for (const ship of r.ships) {
    const model = editorModel(
      r.shipPorts(ship.vehicle.class_name),
      r.components,
    );

    it(`${ship.vehicle.name}: every slot's stock part is an option that fits it`, () => {
      for (const slot of model.slots) {
        if (slot.stock === null) continue;
        const stock = model.options[slot.stock];
        expect(stock, slot.key).toBeDefined();
        expect(optionsFor(slot, model.options).map((o) => o.id)).toContain(
          slot.stock,
        );
      }
    });

    it(`${ship.vehicle.name}: every option offered fits by type and size`, () => {
      for (const slot of model.slots) {
        for (const o of optionsFor(slot, model.options)) {
          expect(o.group).toBe(slot.group);
          expect(o.size).toBeGreaterThanOrEqual(slot.sizeMin);
          expect(o.size).toBeLessThanOrEqual(slot.sizeMax);
        }
      }
    });

    it(`${ship.vehicle.name}: the stock build's guns and missiles agree with the armament counts`, () => {
      const t = totals(model.slots, {}, model.options);
      const arms = armament(
        loadoutGroups(r.shipPorts(ship.vehicle.class_name), stats),
      );
      const missiles = arms.find((a) => a.kind === "missiles")?.total ?? 0;
      expect(t.missiles).toBe(missiles);
    });
  }

  it("the Gladius: three S3 guns and four racks of missiles, all swappable", () => {
    const gladius = r.ships.find(
      (s) => s.vehicle.class_name === "AEGS_Gladius",
    )!;
    const model = editorModel(
      r.shipPorts(gladius.vehicle.class_name),
      r.components,
    );
    const guns = model.slots.filter((s) => s.group === "guns");
    expect(guns).toHaveLength(3);
    expect(guns.every((s) => s.sizeMin === 3 && s.sizeMax === 3)).toBe(true);
    expect(guns.map((s) => s.location).sort()).toEqual([
      "Left wing",
      "Nose",
      "Right wing",
    ]);
    expect(model.slots.filter((s) => s.group === "missiles")).toHaveLength(6);
  });
});

describe("totals", () => {
  const gladius = r.ships.find((s) => s.vehicle.class_name === "AEGS_Gladius")!;
  const model = editorModel(
    r.shipPorts(gladius.vehicle.class_name),
    r.components,
  );
  const stock = totals(model.slots, {}, model.options);

  it("sums the stock guns' damage per second from their records", () => {
    const expected = model.slots
      .filter((s) => s.group === "guns" && s.stock !== null)
      .reduce((n, s) => n + (model.options[s.stock!]!.stats.dps ?? 0), 0);
    expect(stock.gunDps).toBeCloseTo(expected, 5);
    expect(stock.gunDps).toBeGreaterThan(0);
  });

  it("counts a swapped part instead of the stock one, and an emptied slot as nothing", () => {
    const slot = model.slots.find((s) => s.group === "guns")!;
    const other = optionsFor(slot, model.options).find(
      (o) => o.id !== slot.stock,
    )!;
    const swapped = totals(
      model.slots,
      { [slot.key]: other.id },
      model.options,
    );
    const was = model.options[slot.stock!]!.stats.dps ?? 0;
    expect(swapped.gunDps).toBeCloseTo(
      stock.gunDps - was + (other.stats.dps ?? 0),
      5,
    );
    const emptied = totals(model.slots, { [slot.key]: null }, model.options);
    expect(emptied.gunDps).toBeCloseTo(stock.gunDps - was, 5);
  });

  it("reads power from the resource network: plants make it, the rest draw it", () => {
    expect(stock.powerOut).toBeGreaterThan(0);
    expect(stock.powerDraw).toBeGreaterThan(0);
  });
});

describe("optionStats", () => {
  it("leaves every figure empty for a part with no record", () => {
    const s = optionStats(null);
    expect(Object.values(s).every((v) => v === null)).toBe(true);
  });
});

describe("armamentPlan", () => {
  for (const ship of r.ships) {
    it(`${ship.vehicle.name}: draws every gun and missile the counts list, once`, () => {
      const groups = loadoutGroups(r.shipPorts(ship.vehicle.class_name), stats);
      const plan = armamentPlan(groups, () => ({ damage: null, detail: null }));
      const drawn = (kind: "gun" | "ordnance") =>
        plan.reduce(
          (n, m) =>
            n +
            m.copies *
              m.lines
                .filter((l) =>
                  kind === "gun" ? l.kind === "gun" : l.kind !== "gun",
                )
                .reduce((k, l) => k + l.count, 0),
          0,
        );
      const arms = armament(groups);
      expect(drawn("gun")).toBe(
        arms.find((a) => a.kind === "guns")?.total ?? 0,
      );
      expect(drawn("ordnance")).toBe(
        arms.find((a) => a.kind === "missiles")?.total ?? 0,
      );
    });
  }

  it("the Gladius: its gimballed guns are the pilot's, its missiles sit in racks", () => {
    const groups = loadoutGroups(r.shipPorts("AEGS_Gladius"), stats);
    const plan = armamentPlan(groups, () => ({ damage: null, detail: null }));
    expect(plan.map((m) => m.title)).toEqual(["Pilot guns", "Missile racks"]);
  });
});
