import { describe, expect, it } from "vitest";
import {
  type IndexShip,
  applyShipFilters,
  facetValue,
  hasShipFilters,
  parseShipQuery,
  rolesOf,
  shipFacetOptions,
  shipIndexHref,
} from "../lib/ship-filters";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Ship index": filters for manufacturer, role, size class, status and kind as
// URL state. The rows come from the fixture pack; nothing here types a stat or a name.

const pack = bootstrapPack();
const manufacturers = new Map(pack.rows.Manufacturer.map((m) => [m.code, m]));
const stats = new Map(pack.rows.VehicleStats.map((s) => [s.class_name, s]));
const ships: IndexShip[] = pack.rows.Vehicle.map((vehicle) => ({
  vehicle,
  stats: stats.get(vehicle.class_name) ?? null,
  manufacturer: manufacturers.get(vehicle.manufacturer_code) ?? null,
}));
const labels = {
  status: (s: string) => s,
  kind: (k: string) => k,
  size: (s: string) => s,
};

describe("parseShipQuery", () => {
  it("reads each facet and the view, ignoring blanks and unknown keys", () => {
    expect(
      parseShipQuery({
        manufacturer: "aegis-dynamics",
        role: "",
        size: ["small", "large"],
        status: " flight_ready ",
        view: "table",
        other: "x",
      }),
    ).toEqual({
      filters: {
        manufacturer: "aegis-dynamics",
        size: "small",
        status: "flight_ready",
      },
      view: "table",
    });
  });

  it("defaults to cards with no filters", () => {
    expect(parseShipQuery({})).toEqual({ filters: {}, view: "cards" });
    expect(parseShipQuery({ view: "list" }).view).toBe("cards");
    expect(hasShipFilters({})).toBe(false);
    expect(hasShipFilters({ kind: "ship" })).toBe(true);
  });
});

describe("applyShipFilters on the fixture pack", () => {
  it("returns every ship with no filters", () => {
    expect(applyShipFilters(ships, {})).toHaveLength(ships.length);
  });

  it("filters by manufacturer slug", () => {
    const first = ships[0];
    if (first === undefined || first.manufacturer === null)
      throw new Error("pack has no ship with a manufacturer");
    const result = applyShipFilters(ships, {
      manufacturer: first.manufacturer.slug,
    });
    expect(result.length).toBeGreaterThan(0);
    for (const ship of result) {
      expect(ship.vehicle.manufacturer_code).toBe(
        first.vehicle.manufacturer_code,
      );
    }
  });

  it("filters by size class, status and kind from the vehicle row", () => {
    for (const ship of ships) {
      const size = ship.vehicle.size_class;
      if (size === null) continue;
      const bySize = applyShipFilters(ships, { size });
      expect(bySize).toContain(ship);
      for (const other of bySize) expect(other.vehicle.size_class).toBe(size);
    }
    const status = ships[0]?.vehicle.status;
    const kind = ships[0]?.vehicle.kind;
    if (status === undefined || kind === undefined)
      throw new Error("empty pack");
    expect(applyShipFilters(ships, { status, kind }).length).toBe(
      ships.filter(
        (s) => s.vehicle.status === status && s.vehicle.kind === kind,
      ).length,
    );
  });

  it("matches any one of a ship's comma-separated roles", () => {
    const multi = ships.find((s) => rolesOf(s.vehicle).length > 1);
    if (multi === undefined) throw new Error("pack has no multi-role ship");
    for (const role of rolesOf(multi.vehicle)) {
      expect(applyShipFilters(ships, { role: facetValue(role) })).toContain(
        multi,
      );
    }
    expect(applyShipFilters(ships, { role: "no-such-role" })).toHaveLength(0);
  });

  it("combines filters with AND", () => {
    const ship = ships[0];
    if (ship === undefined || ship.vehicle.size_class === null)
      throw new Error("empty pack");
    const result = applyShipFilters(ships, {
      size: ship.vehicle.size_class,
      manufacturer: "no-such-manufacturer",
    });
    expect(result).toHaveLength(0);
  });
});

describe("shipFacetOptions", () => {
  const options = shipFacetOptions(ships, labels);

  it("offers every manufacturer, role, size, status and kind the pack has, each once", () => {
    expect(options.manufacturer.map((o) => o.value).sort()).toEqual(
      [
        ...new Set(
          ships.map((s) => s.manufacturer?.slug ?? s.vehicle.manufacturer_code),
        ),
      ].sort(),
    );
    const roles = new Set(ships.flatMap((s) => rolesOf(s.vehicle)));
    expect(options.role).toHaveLength(roles.size);
    for (const option of options.role)
      expect(roles.has(option.label)).toBe(true);
    expect(options.size.map((o) => o.value)).toEqual(
      [...new Set(ships.map((s) => s.vehicle.size_class))]
        .filter((s): s is string => s !== null)
        .sort((a, b) => sizeRank(a) - sizeRank(b)),
    );
    expect(options.status.map((o) => o.value)).toEqual(
      [...new Set(ships.map((s) => s.vehicle.status))].sort(),
    );
    expect(options.kind.map((o) => o.value)).toEqual(
      [...new Set(ships.map((s) => s.vehicle.kind))].sort(),
    );
  });

  it("labels manufacturers by name and sorts them", () => {
    const names = options.manufacturer.map((o) => o.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    for (const option of options.manufacturer) {
      const m = pack.rows.Manufacturer.find((row) => row.slug === option.value);
      expect(option.label).toBe(m?.name ?? option.value);
    }
  });
});

const SIZE_ORDER = ["vehicle", "snub", "small", "medium", "large", "capital"];
const sizeRank = (s: string): number => {
  const i = SIZE_ORDER.indexOf(s);
  return i < 0 ? SIZE_ORDER.length : i;
};

describe("facetValue", () => {
  it("kebab-cases a role label", () => {
    expect(facetValue("Light Fighter")).toBe("light-fighter");
    expect(facetValue("  Heavy  Bomber ")).toBe("heavy-bomber");
    expect(facetValue("Light Freight, Medium Fighter")).toBe(
      "light-freight-medium-fighter",
    );
  });
});

describe("shipIndexHref", () => {
  it("leaves the default view and empty filters out of the URL", () => {
    expect(shipIndexHref({ filters: {}, view: "cards" })).toBe("/ships");
    expect(shipIndexHref({ filters: {}, view: "table" })).toBe(
      "/ships?view=table",
    );
    expect(
      shipIndexHref({
        filters: { size: "small", manufacturer: "aegis-dynamics" },
        view: "table",
      }),
    ).toBe("/ships?manufacturer=aegis-dynamics&size=small&view=table");
  });

  it("round-trips through parseShipQuery", () => {
    const state = {
      filters: { role: "light-fighter", status: "flight_ready" },
      view: "table" as const,
    };
    const url = new URL(shipIndexHref(state), "http://localhost");
    expect(parseShipQuery(Object.fromEntries(url.searchParams))).toEqual(state);
  });
});
