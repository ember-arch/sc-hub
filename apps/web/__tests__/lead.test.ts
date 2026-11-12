import { describe, expect, it } from "vitest";
import { repo } from "../lib/data";
import { leadExcerpt, pickLead } from "../lib/front";
import { isShort } from "../lib/videos";

// ADR-058: the lead story on the real news pack, which is append-only (CLAUDE.md section 5), so
// what it held on these days it holds for good. As production sees it (every Comm-Link with its
// cover) and as CI does (no media).

const r = repo();
const at = new Date("2026-11-11T20:00:00Z");

describe("the lead story on the pack", () => {
  it("leads with a Comm-Link and its video when the covers are on the CDN", () => {
    const picked = pickLead(r.dispatches, r.videos, () => true, isShort, at);
    expect(picked?.lead.source).toBe("comm_link");
    expect(picked?.lead.title).toBe(
      "Star Citizen | Behind the Ships: RSI Galaxy",
    );
    // The full video rides along; the Short of the same title never does.
    expect(picked?.video?.title).toBe(
      "Star Citizen | Behind the Ships: RSI Galaxy",
    );
    expect(picked?.video !== null && isShort(picked!.video)).toBe(false);
  });

  it("leaves the monthly store bundle and the Shorts out of the lead", () => {
    for (const day of ["2026-11-11T20:00:00Z", "2026-11-12T20:00:00Z"]) {
      const picked = pickLead(
        r.dispatches,
        r.videos,
        () => true,
        isShort,
        new Date(day),
      );
      expect(picked).not.toBeNull();
      expect(picked!.lead.title).not.toMatch(/store bundle/i);
      expect(isShort(picked!.lead)).toBe(false);
    }
  });

  it("leads with a picture in CI too, where only videos have one", () => {
    const picked = pickLead(r.dispatches, r.videos, () => false, isShort, at);
    expect(picked?.lead.source).toBe("video");
    expect(isShort(picked!.lead)).toBe(false);
  });

  it("never leads with what was published today", () => {
    const now = new Date("2026-11-12T20:00:00Z");
    const picked = pickLead(r.dispatches, r.videos, () => true, isShort, now);
    expect(Date.parse(picked!.lead.published_at)).toBeLessThan(
      Date.parse("2026-11-12T00:00:00Z"),
    );
  });
});

describe("the lead's excerpt", () => {
  it("takes CIG's summary without emoji, and none that carries a link", () => {
    expect(leadExcerpt("Join us 🚀 for a look back.")).toBe(
      "Join us for a look back.",
    );
    expect(leadExcerpt("Wishlist on Steam Now: https://bit.ly/47KwKpb")).toBe(
      null,
    );
    expect(leadExcerpt("")).toBeNull();
    expect(leadExcerpt(null)).toBeNull();
  });
});
