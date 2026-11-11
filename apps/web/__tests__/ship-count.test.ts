import { describe, expect, it } from "vitest";
import { repo } from "../lib/data";
import { conceptShips } from "../lib/showcase";
import { shipTally, tallyNote } from "../lib/ship-count";

// ADR-046: the home page said 260 ships but 231 flight ready and 28 in concept, which is 259;
// the register's own concept entry (the Javelin) was in neither.

const ship = (status: "flight_ready" | "in_production" | "concept") => ({
  vehicle: { status },
});

describe("shipTally", () => {
  it("counts every status so the parts add up to the total", () => {
    const tally = shipTally(
      [
        ship("flight_ready"),
        ship("flight_ready"),
        ship("concept"),
        ship("in_production"),
      ],
      3,
    );
    expect(tally.total).toBe(7);
    expect(tallyNote(tally)).toBe(
      "2 flight ready · 1 in production · 4 in concept",
    );
    expect(tally.parts.reduce((n, p) => n + p.count, 0)).toBe(tally.total);
  });

  it("leaves out a status with none", () => {
    expect(tallyNote(shipTally([ship("flight_ready")], 0))).toBe(
      "1 flight ready",
    );
  });

  it("adds up on the pack", () => {
    const tally = shipTally(repo().entries, conceptShips().length);
    expect(tally.parts.reduce((n, p) => n + p.count, 0)).toBe(tally.total);
    expect(tally.total).toBe(repo().entries.length + conceptShips().length);
  });
});
