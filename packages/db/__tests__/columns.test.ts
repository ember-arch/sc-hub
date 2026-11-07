import { describe, expect, it } from "vitest";
import { postgresTimestampToIso } from "../src/schema/columns.js";

// The string branch is what postgres.js hands back from a real Postgres; PGlite may hand back a
// Date. Both must become the contract's ISO 8601 string.

describe("postgresTimestampToIso", () => {
  it.each([
    ["2026-01-01 00:00:00+00", "2026-01-01T00:00:00.000Z"],
    ["2026-01-01 12:34:56.789+00", "2026-01-01T12:34:56.789Z"],
    ["2026-01-01 12:34:56+05:30", "2026-01-01T07:04:56.000Z"],
    ["2026-01-01 12:34:56-04", "2026-01-01T16:34:56.000Z"],
    ["2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"],
  ])("normalizes %s", (input, expected) => {
    expect(postgresTimestampToIso(input)).toBe(expected);
  });

  it("accepts a Date", () => {
    expect(postgresTimestampToIso(new Date(0))).toBe(
      "1970-01-01T00:00:00.000Z",
    );
  });

  it("rejects anything that is not a timestamp", () => {
    expect(() => postgresTimestampToIso("yesterday")).toThrow(TypeError);
    expect(() => postgresTimestampToIso(42)).toThrow(TypeError);
    expect(() => postgresTimestampToIso(null)).toThrow(TypeError);
  });
});
