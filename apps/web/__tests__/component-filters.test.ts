import { describe, expect, it } from "vitest";
import {
  type IndexComponent,
  applyComponentFilters,
  componentFacetOptions,
  componentIndexHref,
  hasComponentFilters,
  parseComponentQuery,
  parseFixedShown,
  withoutFixed,
  FIXED_TYPES,
} from "../lib/component-filters";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Component index and pages": size and manufacturer filters as URL state.

const pack = bootstrapPack();
const manufacturers = new Map(pack.rows.Manufacturer.map((m) => [m.code, m]));
const components: IndexComponent[] = pack.rows.Item.map((item) => ({
  item,
  manufacturer: manufacturers.get(item.manufacturer_code) ?? null,
}));

describe("parseComponentQuery", () => {
  it("reads size and manufacturer and nothing else", () => {
    expect(
      parseComponentQuery({ size: "3", manufacturer: "behring", type: "x" }),
    ).toEqual({ size: "3", manufacturer: "behring" });
    expect(parseComponentQuery({ size: "" })).toEqual({});
    expect(hasComponentFilters({})).toBe(false);
    expect(hasComponentFilters({ size: "1" })).toBe(true);
  });
});

describe("applyComponentFilters on the fixture pack", () => {
  it("filters by size", () => {
    const sizes = [...new Set(components.map((c) => c.item.size))];
    expect(sizes.length).toBeGreaterThan(1);
    for (const size of sizes) {
      const result = applyComponentFilters(components, { size: String(size) });
      expect(result.length).toBe(
        components.filter((c) => c.item.size === size).length,
      );
      for (const c of result) expect(c.item.size).toBe(size);
    }
  });

  it("filters by manufacturer slug and combines with size", () => {
    const sample = components.find((c) => c.manufacturer !== null);
    if (sample === undefined || sample.manufacturer === null)
      throw new Error("pack has no component with a manufacturer");
    const byMaker = applyComponentFilters(components, {
      manufacturer: sample.manufacturer.slug,
    });
    expect(byMaker).toContain(sample);
    for (const c of byMaker)
      expect(c.item.manufacturer_code).toBe(sample.item.manufacturer_code);
    const both = applyComponentFilters(components, {
      manufacturer: sample.manufacturer.slug,
      size: String(sample.item.size),
    });
    expect(both).toContain(sample);
    expect(both.length).toBeLessThanOrEqual(byMaker.length);
  });

  it("returns nothing for an unknown value instead of everything", () => {
    expect(
      applyComponentFilters(components, { manufacturer: "no-such-maker" }),
    ).toHaveLength(0);
    expect(applyComponentFilters(components, { size: "99" })).toHaveLength(0);
  });
});

describe("componentFacetOptions", () => {
  const options = componentFacetOptions(components);

  it("lists every size in ascending order and every manufacturer by name", () => {
    expect(options.size.map((o) => Number(o.value))).toEqual(
      [...new Set(components.map((c) => c.item.size))].sort((a, b) => a - b),
    );
    expect(options.manufacturer).toHaveLength(
      new Set(
        components.map((c) => c.manufacturer?.slug ?? c.item.manufacturer_code),
      ).size,
    );
    const labels = options.manufacturer.map((o) => o.label);
    expect(labels).toEqual(
      [...labels].sort((a, b) => a.localeCompare(b, "en")),
    );
  });
});

describe("componentIndexHref", () => {
  it("builds the query string and omits empty filters", () => {
    expect(componentIndexHref({})).toBe("/components");
    expect(componentIndexHref({ size: "2", manufacturer: "behring" })).toBe(
      "/components?size=2&manufacturer=behring",
    );
  });
});

// ADR-046: thrusters and fuel intakes come with the ship; the index lists them on request.
describe("the fixed parts", () => {
  it("are left out unless asked for, and only they are", () => {
    const fitted = withoutFixed(components, false);
    expect(fitted.some((c) => FIXED_TYPES.has(c.item.type))).toBe(false);
    expect(fitted.length).toBe(
      components.filter((c) => !FIXED_TYPES.has(c.item.type)).length,
    );
    expect(fitted.length).toBeLessThan(components.length);
    expect(withoutFixed(components, true)).toBe(components);
  });

  it("are asked for with ?fixed=shown, which the index links keep", () => {
    expect(parseFixedShown({ fixed: "shown" })).toBe(true);
    expect(parseFixedShown({ fixed: "yes" })).toBe(false);
    expect(parseFixedShown({})).toBe(false);
    expect(componentIndexHref({ size: "2" }, true)).toBe(
      "/components?size=2&fixed=shown",
    );
    expect(componentIndexHref({}, false)).toBe("/components");
    expect(hasComponentFilters(parseComponentQuery({ fixed: "shown" }))).toBe(
      false,
    );
  });
});
