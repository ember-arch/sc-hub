import { describe, expect, it } from "vitest";
import { registry } from "../registry.js";
import { loadFixture } from "./helpers.js";

const entries = Object.entries(registry) as [
  keyof typeof registry,
  (typeof registry)[keyof typeof registry],
][];

/** A value no field of that shape accepts. Nullable fields never accept arrays, so null gets one. */
function wrongValueFor(value: unknown): unknown {
  if (value === null) return ["wrong type"];
  if (Array.isArray(value)) return "not an array";
  switch (typeof value) {
    case "string":
      return 12345;
    case "number":
      return "twelve";
    case "boolean":
      return "yes";
    default:
      return "not an object";
  }
}

describe.each(entries)("%s", (name, schema) => {
  const fixture = loadFixture(name);

  it("accepts its fixture", () => {
    const result = schema.safeParse(fixture);
    expect(
      result.success,
      result.success ? "" : JSON.stringify(result.error.issues),
    ).toBe(true);
  });

  it("round-trips through JSON unchanged", () => {
    const once = schema.parse(fixture);
    const twice = schema.parse(JSON.parse(JSON.stringify(once)) as unknown);
    expect(twice).toEqual(once);
    // No defaults or transforms on entities, so what goes in is exactly what comes out.
    expect(twice).toEqual(fixture);
  });

  it("rejects a missing field, one field at a time", () => {
    for (const key of Object.keys(fixture)) {
      const copy: Record<string, unknown> = { ...fixture };
      delete copy[key];
      expect(
        schema.safeParse(copy).success,
        `${name} without ${key} should fail`,
      ).toBe(false);
    }
  });

  it("rejects an unknown field, so an unknown shape halts the import (ADR-002 rule 5)", () => {
    expect(schema.safeParse({ ...fixture, unexpected_field: 1 }).success).toBe(
      false,
    );
  });

  it("rejects a wrong type on every field", () => {
    for (const [key, value] of Object.entries(fixture)) {
      const copy = { ...fixture, [key]: wrongValueFor(value) };
      expect(
        schema.safeParse(copy).success,
        `${name}.${key} with a wrong type should fail`,
      ).toBe(false);
    }
  });
});
