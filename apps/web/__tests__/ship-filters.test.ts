import { sizeClassOrder } from "schema";
import { describe, expect, it } from "vitest";
import {
  type IndexShip,
  applyShipFilters,
  facetValue,
  hasShipFilters,
  matchesSearch,
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
const first = ships[0];
if (first === undefined || first.manufacturer === null)
  throw new Error("pack has no ship with a manufacturer row");
const firstMaker = first.manufacturer;

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

  it("reads the search, trimmed, and keeps it in the URL first", () => {
    expect(parseShipQuery({ q: "  gladius " }).filters).toEqual({
      q: "gladius",
    });
    expect(parseShipQuery({ q: "   " }).filters).toEqual({});
    expect(hasShipFilters({ q: "x" })).toBe(true);
    expect(
      shipIndexHref({
        filters: { q: "gladius", size: "small" },
        view: "table",
      }),
    ).toBe("/ships?q=gladius&size=small&view=table");
  });
});

describe("the search", () => {
  it("matches a name, a maker's name or code, or a class name, whatever the case", () => {
    const found = applyShipFilters(ships, { q: "GLADIUS" });
    expect(found.length).toBeGreaterThan(0);
    for (const s of found) {
      expect(
        [s.vehicle.name, s.vehicle.class_name].some((f) =>
          f.toLowerCase().includes("gladius"),
        ),
      ).toBe(true);
    }
    const byMaker = applyShipFilters(ships, { q: "aegis" });
    expect(byMaker.length).toBeGreaterThan(0);
    expect(
      byMaker.every((s) => s.manufacturer?.name === "Aegis Dynamics"),
    ).toBe(true);
    expect(applyShipFilters(ships, { q: "AEGS" }).length).toBe(byMaker.length);
    expect(matchesSearch("", ["anything"])).toBe(true);
    expect(matchesSearch("san tok", ["San'tok.yāi"])).toBe(true);
    expect(applyShipFilters(ships, { q: "no such ship anywhere" })).toEqual([]);
  });

  it("combines with the facets", () => {
    const small = applyShipFilters(ships, { q: "aegis", size: "small" });
    for (const s of small) {
      expect(s.manufacturer?.name).toBe("Aegis Dynamics");
      expect(s.vehicle.size_class).toBe("small");
    }
  });
});

describe("applyShipFilters on the fixture pack", () => {
  it("returns every ship with no filters", () => {
    expect(applyShipFilters(ships, {})).toHaveLength(ships.length);
  });

  it("filters by manufacturer slug, and never by the code", () => {
    const result = applyShipFilters(ships, {
      manufacturer: firstMaker.slug,
    });
    expect(result.length).toBeGreaterThan(0);
    for (const ship of result) {
      expect(ship.vehicle.manufacturer_code).toBe(
        first.vehicle.manufacturer_code,
      );
    }
    expect(
      applyShipFilters(ships, {
        manufacturer: first.vehicle.manufacturer_code,
      }),
    ).toHaveLength(0);
  });

  it("filters by size class, status and kind from the vehicle row", () => {
    for (const ship of ships) {
      const size = ship.vehicle.size_class;
      if (size === null) continue;
      const bySize = applyShipFilters(ships, { size });
      expect(bySize).toContain(ship);
      for (const other of bySize) expect(other.vehicle.size_class).toBe(size);
    }
    const { status, kind } = first.vehicle;
    expect(applyShipFilters(ships, { status, kind }).length).toBe(
      ships.filter(
        (s) => s.vehicle.status === status && s.vehicle.kind === kind,
      ).length,
    );
  });

  const multi = ships.find((s) => rolesOf(s.vehicle).length > 1);
  it.skipIf(multi === undefined)(
    "matches any one of a ship's comma-separated roles",
    () => {
      if (multi === undefined) return;
      for (const role of rolesOf(multi.vehicle)) {
        expect(applyShipFilters(ships, { role: facetValue(role) })).toContain(
          multi,
        );
      }
    },
  );

  it("matches no ship for an unknown role and combines filters with AND", () => {
    expect(applyShipFilters(ships, { role: "no-such-role" })).toHaveLength(0);
    if (first.vehicle.size_class === null) return;
    expect(
      applyShipFilters(ships, {
        size: first.vehicle.size_class,
        manufacturer: "no-such-manufacturer",
      }),
    ).toHaveLength(0);
  });
});

describe("shipFacetOptions", () => {
  const options = shipFacetOptions(ships, labels);

  it("offers every manufacturer, role, size, status and kind the pack has, each once", () => {
    expect(options.manufacturer.map((o) => o.value).sort()).toEqual(
      [
        ...new Set(
          ships.flatMap((s) =>
            s.manufacturer === null ? [] : [s.manufacturer.slug],
          ),
        ),
      ].sort(),
    );
    const roles = new Set(ships.flatMap((s) => rolesOf(s.vehicle)));
    expect(options.role).toHaveLength(roles.size);
    for (const option of options.role)
      expect(roles.has(option.label)).toBe(true);
    expect(options.status.map((o) => o.value)).toEqual(
      [...new Set(ships.map((s) => s.vehicle.status))].sort(),
    );
    expect(options.kind.map((o) => o.value)).toEqual(
      [...new Set(ships.map((s) => s.vehicle.kind))].sort(),
    );
  });

  it("orders sizes as the data model lists them, not alphabetically", () => {
    const values = options.size.map((o) => o.value);
    const positions = values.map((v) =>
      (sizeClassOrder as readonly string[]).indexOf(v),
    );
    // Every size in the pack is a documented class, and they come out in documented order.
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(values).not.toEqual([...values].sort());
  });

  it("labels manufacturers by name and sorts them", () => {
    const names = options.manufacturer.map((o) => o.label);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    for (const option of options.manufacturer) {
      const m = pack.rows.Manufacturer.find((row) => row.slug === option.value);
      expect(option.label).toBe(m?.name);
    }
  });
});

describe("facetValue", () => {
  it("kebab-cases one role label", () => {
    expect(facetValue("Light Fighter")).toBe("light-fighter");
    expect(facetValue("  Heavy  Bomber ")).toBe("heavy-bomber");
  });

  it("splits a multi-role ship-matrix string into one value per role", () => {
    const multi = ships.find((s) => rolesOf(s.vehicle).length > 1);
    if (multi === undefined) return;
    const values = rolesOf(multi.vehicle).map(facetValue);
    expect(values.length).toBeGreaterThan(1);
    for (const value of values)
      expect(value).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
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
