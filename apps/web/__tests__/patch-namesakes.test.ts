import { describe, expect, it } from "vitest";
import { compareSnapshots, namesakesOf, snapshotOf } from "../lib/patches";

// The game keeps variants under one name. 4.10.3 brought a "Caterpillar" record of its own
// (DRAK_Caterpillar_Boarded_ShatteredBlade) while DRAK_Caterpillar stayed, and retired the old
// Hammerhead record while AEGS_Hammerhead_GS stayed; the owner read the first as the Caterpillar
// being new (2026-11-13). A new or removed ship says which record it is.

describe("namesakesOf", () => {
  const map = (entries: [string, string[]][]) => new Map(entries);
  const key = (maker: string, name: string) => `${maker}\u0000${name}`;

  it("names the other records of the same name and maker in each build", () => {
    const before = map([[key("DRAK", "Caterpillar"), ["DRAK_Caterpillar"]]]);
    const after = map([
      [
        key("DRAK", "Caterpillar"),
        ["DRAK_Caterpillar", "DRAK_Caterpillar_Boarded_ShatteredBlade"],
      ],
    ]);
    expect(
      namesakesOf(
        "DRAK_Caterpillar_Boarded_ShatteredBlade",
        { name: "Caterpillar", manufacturer: "DRAK" },
        before,
        after,
      ),
    ).toEqual({ before: ["DRAK_Caterpillar"], after: ["DRAK_Caterpillar"] });
    // Another maker's ship of the name is not a namesake; nor is the record itself.
    expect(
      namesakesOf(
        "ANVL_Caterpillar",
        { name: "Caterpillar", manufacturer: "ANVL" },
        before,
        after,
      ),
    ).toEqual({ before: [], after: [] });
  });
});

describe("4.10.3 against 4.10.2", () => {
  const from = snapshotOf("4.10.2-LIVE.12881860");
  const to = snapshotOf("4.10.3-LIVE.13165946");

  it("tells a new Caterpillar variant and a retired Hammerhead record from the ships", () => {
    if (from === null || to === null) return;
    const { ships } = compareSnapshots(from, to);
    const caterpillar = ships.added.find(
      (e) => e.id === "DRAK_Caterpillar_Boarded_ShatteredBlade",
    );
    expect(caterpillar?.namesakes?.before).toEqual(["DRAK_Caterpillar"]);
    const hammerhead = ships.removed.find((e) => e.id === "AEGS_Hammerhead");
    expect(hammerhead?.namesakes?.after).toEqual(["AEGS_Hammerhead_GS"]);
    // A new ship of a name all its own has none.
    const liberator = ships.added.find((e) => e.id === "ANVL_Liberator");
    expect(liberator?.namesakes).toEqual({ before: [], after: [] });
  });
});
