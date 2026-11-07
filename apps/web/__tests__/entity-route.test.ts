import { Vehicle } from "schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { entityForSlug } from "../lib/entity-route";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Slugs and redirects": an entity route answers an old slug with Next's
// permanent redirect to the current path and an unknown slug with notFound(). Both Next functions
// throw in the real runtime; the mocks throw too, so the test sees the same control flow.

const navigation = vi.hoisted(() => ({
  permanentRedirect: vi.fn((url: string): never => {
    throw new Error(`permanentRedirect ${url}`);
  }),
  notFound: vi.fn((): never => {
    throw new Error("notFound");
  }),
}));
vi.mock("next/navigation", () => navigation);

const vehicles = bootstrapPack().rows.Vehicle;
const base = vehicles[0];
if (base === undefined) throw new Error("pack has no vehicles");
const renamed = Vehicle.parse({
  ...base,
  slug: `${base.slug}-renamed`,
  slug_history: [base.slug],
});
const rows = [renamed, ...vehicles.slice(1)];

describe("entityForSlug", () => {
  beforeEach(() => {
    navigation.permanentRedirect.mockClear();
    navigation.notFound.mockClear();
  });

  it("returns the entity for a current slug without redirecting", () => {
    expect(entityForSlug(rows, renamed.slug, "/ships")).toBe(renamed);
    expect(navigation.permanentRedirect).not.toHaveBeenCalled();
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("permanently redirects an old slug to the current path", () => {
    expect(() => entityForSlug(rows, base.slug, "/ships")).toThrow(
      `permanentRedirect /ships/${renamed.slug}`,
    );
    expect(navigation.permanentRedirect).toHaveBeenCalledTimes(1);
    expect(navigation.permanentRedirect).toHaveBeenCalledWith(
      `/ships/${renamed.slug}`,
    );
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("sends an unknown slug to the 404 page", () => {
    expect(() => entityForSlug(rows, "no-such-ship", "/ships")).toThrow(
      "notFound",
    );
    expect(navigation.notFound).toHaveBeenCalledTimes(1);
    expect(navigation.permanentRedirect).not.toHaveBeenCalled();
  });
});
