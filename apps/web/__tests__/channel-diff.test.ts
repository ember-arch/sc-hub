import { VehicleStats } from "schema";
import { describe, expect, it } from "vitest";
import { channelDeltas, hasDeltas } from "../lib/channel-diff";
import { bootstrapPack } from "./pack";

// Spec 02, criterion "PTU diff toggle": PTU values display as deltas against LIVE. The pack has
// no PTU row, so the PTU side is a synthetic copy of a fixture row with a few values moved; it
// still has to validate as a VehicleStats row.

const live = bootstrapPack().rows.VehicleStats[0];
if (live === undefined) throw new Error("pack has no VehicleStats row");

describe("channelDeltas", () => {
  it("is empty when PTU equals LIVE", () => {
    const ptu = VehicleStats.parse({
      ...live,
      channel: "PTU",
      game_version: `${live.game_version}-ptu`,
    });
    expect(channelDeltas(live, ptu)).toEqual({});
    expect(hasDeltas(channelDeltas(live, ptu))).toBe(false);
  });

  it("reports PTU minus LIVE for every numeric field that differs, and nothing else", () => {
    const ptu = VehicleStats.parse({
      ...live,
      channel: "PTU",
      game_version: `${live.game_version}-ptu`,
      mass_kg: live.mass_kg + 100,
      scm_speed: live.scm_speed === null ? null : live.scm_speed - 5,
      raw: { ...live.raw, extra: 1 },
    });
    const deltas = channelDeltas(live, ptu);
    expect(deltas.mass_kg).toBe(100);
    if (live.scm_speed !== null) expect(deltas.scm_speed).toBe(-5);
    // Strings (channel, game_version) and objects (raw) never produce a delta.
    expect(Object.keys(deltas).sort()).toEqual(
      live.scm_speed === null ? ["mass_kg"] : ["mass_kg", "scm_speed"],
    );
    expect(hasDeltas(deltas)).toBe(true);
  });

  it("skips a field that is null on either side", () => {
    const ptu = VehicleStats.parse({
      ...live,
      channel: "PTU",
      cargo_scu: null,
      hydrogen_fuel: 12,
    });
    const deltas = channelDeltas(live, ptu);
    expect(deltas.cargo_scu).toBeUndefined();
    expect(deltas.hydrogen_fuel).toBeUndefined();
  });
});
