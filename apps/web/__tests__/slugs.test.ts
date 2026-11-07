import { Vehicle } from "schema";
import { describe, expect, it } from "vitest";
import { resolveSlug, resolveSlugs } from "../lib/slugs";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Slugs and redirects": old slugs in slug_history resolve to the current slug
// (the page answers with a permanent redirect); unknown slugs resolve to nothing (the page 404s).
// The pack's histories are empty, so the renamed ship is a synthetic copy of a fixture row.

const vehicles = bootstrapPack().rows.Vehicle;
const base = vehicles[0];
if (base === undefined) throw new Error("pack has no vehicles");

describe("resolveSlug", () => {
  it("finds a current slug", () => {
    const result = resolveSlug(vehicles, base.slug);
    expect(result.status).toBe("current");
    if (result.status === "current") expect(result.entity).toBe(base);
  });

  it("resolves an old slug to the renamed ship", () => {
    const renamed = Vehicle.parse({
      ...base,
      slug: `${base.slug}-renamed`,
      slug_history: [base.slug, `${base.slug}-older`],
    });
    const rows = [renamed, ...vehicles.slice(1)];
    for (const old of renamed.slug_history) {
      const result = resolveSlug(rows, old);
      expect(result.status).toBe("moved");
      if (result.status === "moved") {
        expect(result.to).toBe(renamed.slug);
        expect(result.entity).toBe(renamed);
      }
    }
    expect(resolveSlug(rows, renamed.slug).status).toBe("current");
  });

  it("lets a current slug win over another ship's history", () => {
    // A slug that is current for one ship and historical for another resolves to the current one.
    const [a, b] = vehicles;
    if (a === undefined || b === undefined)
      throw new Error("pack needs two ships");
    const bWithHistory = Vehicle.parse({ ...b, slug_history: [a.slug] });
    const result = resolveSlug([a, bWithHistory], a.slug);
    expect(result.status).toBe("current");
    if (result.status === "current") expect(result.entity).toBe(a);
  });

  it("reports an unknown slug as missing", () => {
    expect(resolveSlug(vehicles, "no-such-ship")).toEqual({
      status: "missing",
    });
  });
});

describe("resolveSlugs", () => {
  it("replaces old slugs in a list, keeps unknown ones, and says whether anything moved", () => {
    const renamed = Vehicle.parse({
      ...base,
      slug: `${base.slug}-renamed`,
      slug_history: [base.slug],
    });
    const rows = [renamed, ...vehicles.slice(1)];
    const other = vehicles[1]?.slug ?? "";
    expect(resolveSlugs(rows, [base.slug, other, "no-such-ship"])).toEqual({
      slugs: [renamed.slug, other, "no-such-ship"],
      moved: true,
    });
    // The old and the new slug of one ship collapse to one entry.
    expect(resolveSlugs(rows, [base.slug, renamed.slug]).slugs).toEqual([
      renamed.slug,
    ]);
    expect(resolveSlugs(vehicles, [other]).moved).toBe(false);
  });
});
