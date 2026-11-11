import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { agilityOf, formatTurn } from "../lib/agility";
import { REPO_ROOT } from "../lib/data";

// ADR-043: pitch, yaw and roll as the vehicle's record gives them, on the committed pack.

interface Row {
  readonly class_name: string;
  readonly raw: unknown;
}
const rows = JSON.parse(
  readFileSync(
    join(REPO_ROOT, "fixtures", "bootstrap", "VehicleStats.json"),
    "utf8",
  ),
) as Row[];
const raw = (className: string): unknown =>
  rows.find((r) => r.class_name === className)?.raw;

describe("agilityOf", () => {
  it("reads the three turn rates and the boosted ones from the record", () => {
    expect(agilityOf(raw("AEGS_Gladius"))).toEqual({
      pitch: { rate: 68, boosted: 81.6 },
      yaw: { rate: 52, boosted: 62.4 },
      roll: { rate: 200, boosted: 240 },
    });
  });

  it("gives none to a ground vehicle, whose record has no turn rates, and reads a hoverbike's", () => {
    expect(agilityOf(raw("GRIN_ROC"))).toBeNull();
    expect(agilityOf(raw("MRAI_Pulse"))?.roll.rate).toBe(135);
    // Every record without turn rates leaves them null, never zero (ADR-043).
    for (const r of rows) {
      const block = (r.raw as { agility?: Record<string, unknown> } | null)
        ?.agility;
      if (agilityOf(r.raw) === null && block !== undefined)
        expect(block["pitch"] ?? null, r.class_name).toBeNull();
    }
  });

  it("keeps a fractional rate as the record gives it", () => {
    expect(agilityOf(raw("ANVL_Asgard"))?.pitch.rate).toBe(32.5);
  });

  it("refuses a record with an axis missing, zero or not a number, and keeps a missing boost as null", () => {
    const base = { pitch: 10, yaw: 10, roll: 20 };
    expect(agilityOf({ agility: { ...base, roll: 0 } })).toBeNull();
    expect(agilityOf({ agility: { pitch: 10, yaw: 10 } })).toBeNull();
    expect(agilityOf({ agility: { ...base, yaw: "10" } })).toBeNull();
    expect(agilityOf({})).toBeNull();
    expect(agilityOf(null)).toBeNull();
    expect(agilityOf({ agility: base })?.roll).toEqual({
      rate: 20,
      boosted: null,
    });
  });
});

describe("formatTurn", () => {
  it("prints the rate and the boosted rate in degrees per second", () => {
    expect(formatTurn({ rate: 68, boosted: 81.6 })).toBe(
      "68 °/s, 81.6 boosted",
    );
    expect(formatTurn({ rate: 6, boosted: null })).toBe("6 °/s");
    expect(formatTurn({ rate: 32.5, boosted: 39 })).toBe(
      "32.5 °/s, 39 boosted",
    );
  });
});
