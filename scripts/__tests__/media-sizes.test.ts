import { describe, expect, it } from "vitest";
import { mp4Size } from "../media/mp4.js";
import { originalOf } from "../media/sources.js";

// ADR-015: heroes come from RSI's original uploads; render loops keep their own proportions.

describe("RSI original images", () => {
  it("swaps the listed size for the original upload", () => {
    expect(
      originalOf(
        "https://media.robertsspaceindustries.com/asbrpwjjho1z0/wallpaper_1920x1080.jpg",
      ),
    ).toBe("https://media.robertsspaceindustries.com/asbrpwjjho1z0/source.jpg");
    expect(
      originalOf(
        "https://media.robertsspaceindustries.com/bau5bdotm8te8/wallpaper_1920x1080.png",
      ),
    ).toBe("https://media.robertsspaceindustries.com/bau5bdotm8te8/source.png");
  });
});

/** A minimal track header box: "tkhd", version, zeros, then width and height in 16.16. */
function tkhd(version: 0 | 1, width: number, height: number): Uint8Array {
  const times = version === 1 ? 32 : 20;
  const bytes = new Uint8Array(4 + 4 + 4 + times + 8 + 8 + 36 + 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length);
  bytes.set([0x74, 0x6b, 0x68, 0x64], 4);
  bytes[8] = version;
  const at = 8 + 4 + times + 8 + 8 + 36;
  view.setUint32(at, width * 65536);
  view.setUint32(at + 4, height * 65536);
  return bytes;
}

describe("MP4 picture size", () => {
  it("reads the first track's size in either header version", () => {
    expect(mp4Size(tkhd(0, 1920, 580))).toEqual({ width: 1920, height: 580 });
    expect(mp4Size(tkhd(1, 3840, 2160))).toEqual({
      width: 3840,
      height: 2160,
    });
  });

  it("returns null for a file with no sized track", () => {
    expect(mp4Size(new Uint8Array(64))).toBeNull();
  });
});
