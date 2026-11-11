import { describe, expect, it } from "vitest";
import { SPECTRUM_PICTURE_ID, SPECTRUM_PICTURE_ID_SOURCE } from "../media.js";

// ADR-037: a Spectrum picture is an upload's number or "e-" and an embed's slug; nothing else.

describe("SPECTRUM_PICTURE_ID", () => {
  it("takes an upload's number and an embed's e- slug", () => {
    for (const id of ["3481105", "0", "e-tgcvmgrkzycyy", "e-a1"]) {
      expect(SPECTRUM_PICTURE_ID.test(id), id).toBe(true);
    }
  });

  it("refuses every other shape", () => {
    for (const id of [
      "",
      "e-",
      "e-A",
      "e-a-b",
      "e-a_b",
      "3e-1",
      "upload:1",
      "-1",
      "1.5",
      "e-a b",
    ]) {
      expect(SPECTRUM_PICTURE_ID.test(id), id).toBe(false);
    }
  });

  it("is built from the same source a larger pattern takes", () => {
    expect(SPECTRUM_PICTURE_ID.source).toBe(
      `^(?:${SPECTRUM_PICTURE_ID_SOURCE})$`,
    );
  });
});
