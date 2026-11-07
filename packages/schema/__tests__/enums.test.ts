import { describe, expect, it } from "vitest";
import { ItemType, PortType, enums } from "../enums.js";

describe.each(Object.entries(enums))("%s", (_name, schema) => {
  it("accepts every member", () => {
    for (const option of schema.options) {
      expect(schema.safeParse(option).success).toBe(true);
    }
  });

  it("rejects a value that is not a member", () => {
    expect(schema.safeParse("not_a_real_value").success).toBe(false);
    expect(schema.safeParse("").success).toBe(false);
    expect(schema.safeParse(1).success).toBe(false);
  });
});

describe("PortType", () => {
  it("is ItemType plus paint, interior and cargo_grid", () => {
    expect([...PortType.options]).toEqual([
      ...ItemType.options,
      "paint",
      "interior",
      "cargo_grid",
    ]);
  });
});
