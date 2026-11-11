import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { encodeCoverRenditions } from "../media/cover-renditions.js";

// ADR-029, ADR-048: the one encoder prepare.ts and the CI cover step share. A picture made in
// memory stands in for a cover; no network.

const picture = (width: number, height: number): Promise<Buffer> =>
  sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();

describe("a cover's web copies", () => {
  it("makes every width the picture is wide enough for, widest first, at its own proportions", async () => {
    const out = await encodeCoverRenditions(await picture(2000, 1000));
    expect(out.map((r) => [r.width, r.height])).toEqual([
      [1920, 960],
      [1280, 640],
      [960, 480],
      [640, 320],
      [480, 240],
    ]);
    for (const r of out) {
      const meta = await sharp(r.data).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(r.width);
    }
  });

  it("never upscales, and makes nothing from a picture narrower than every width", async () => {
    const out = await encodeCoverRenditions(await picture(1119, 600));
    expect(out.map((r) => r.width)).toEqual([960, 640, 480]);
    expect(await encodeCoverRenditions(await picture(300, 200))).toEqual([]);
  });

  it("gives the same bytes for the same picture, so the keys repeat", async () => {
    const input = await picture(1000, 500);
    const [a, b] = [
      await encodeCoverRenditions(input),
      await encodeCoverRenditions(input),
    ];
    expect(a.map((r) => r.data.equals(b[a.indexOf(r)]!.data))).toEqual([
      true,
      true,
      true,
    ]);
  });
});
