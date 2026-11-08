import { describe, expect, it } from "vitest";
import { buildRepository } from "../lib/data";
import { shipFacts } from "../lib/views";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "Ship page", with the owner's ADR-007 change: the key facts are role, size,
// crew, cargo, length and mass. Manufacturer and status are in the hero, so the block does not
// repeat them. Checked over every ship in the fixture pack.

const r = buildRepository(bootstrapPack(), []);

describe("shipFacts", () => {
  for (const ship of r.ships) {
    it(`${ship.vehicle.name}: six facts in order, none repeating the hero`, () => {
      const facts = shipFacts(ship);
      expect(facts.map((f) => f.label)).toEqual([
        "Role",
        "Size",
        "Crew",
        "Cargo",
        "Length",
        "Mass",
      ]);
      // Preformatted numbers are flagged so the block sets them in mono.
      for (const label of ["Crew", "Length", "Mass"]) {
        expect(facts.find((f) => f.label === label)?.numeric, label).toBe(true);
      }
      expect(facts.find((f) => f.label === "Cargo")?.unit).toBe("SCU");
      if (ship.stats !== null) {
        expect(facts.find((f) => f.label === "Cargo")?.value).toBe(
          ship.stats.cargo_scu,
        );
      }
    });
  }
});
