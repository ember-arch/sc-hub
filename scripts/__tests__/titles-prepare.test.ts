import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TitleIconMedia } from "schema";
import { afterEach, describe, expect, it } from "vitest";
import {
  type ImagePipeline,
  type ImageTool,
  iconStem,
  prepareTitleIcons,
} from "../titles/prepare-icons.js";

// prepareTitleIcons with a fake image tool: no sharp, no real images, no network.

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function fakeImageTool(sizes: Record<string, [number, number]>) {
  const writes: { input: string; box: number; path: string }[] = [];
  const tool: ImageTool = (input) => {
    const name = input.split(/[\\/]/).at(-1) ?? "";
    const [w, h] = sizes[name] ?? [0, 0];
    let box = 0;
    const pipeline: ImagePipeline = {
      metadata: async () => ({ width: w, height: h }),
      resize: (o) => {
        box = o.width;
        return pipeline;
      },
      webp: () => pipeline,
      toFile: async (path) => {
        writes.push({ input: name, box, path });
        const scale = Math.min(1, box / Math.max(w, h));
        return { width: Math.round(w * scale), height: Math.round(h * scale) };
      },
    };
    return pipeline;
  };
  return { tool, writes };
}

function sourcesDir(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), "titles-media-"));
  dirs.push(dir);
  const rows = files.map((file) => ({
    file,
    url: `https://media.starcitizen.tools/x/${file}`,
    file_page: `https://starcitizen.tools/File:${file}`,
    bytes: 10,
    sha256: "0".repeat(64),
    fetched_at: "2026-11-08T00:00:00Z",
  }));
  writeFileSync(join(dir, "sources.json"), JSON.stringify(rows));
  for (const f of files) writeFileSync(join(dir, f), "x");
  return dir;
}

describe("prepareTitleIcons", () => {
  it("makes 128 and 64 px copies, never larger than the original", async () => {
    const src = sourcesDir(["Big.png", "Small.png", "Tiny.png"]);
    const media = mkdtempSync(join(tmpdir(), "media-"));
    dirs.push(media);
    const { tool } = fakeImageTool({
      "Big.png": [1047, 1040],
      "Small.png": [61, 61],
      "Tiny.png": [20, 20],
    });
    const out = await prepareTitleIcons({
      image: tool,
      sourcesDir: src,
      mediaDir: media,
    });
    expect(out.map((e) => TitleIconMedia.parse(e))).toHaveLength(3);
    const widths = (file: string) =>
      out.find((e) => e.file === file)?.renditions.map((r) => r.width);
    expect(widths("Big.png")).toEqual([128, 64]);
    expect(widths("Small.png")).toEqual([61]);
    expect(widths("Tiny.png")).toEqual([20]);
    expect(out[0]?.renditions[0]?.src).toBe("/media/titles/big-png-128.webp");
  });

  it("writes nothing when no icons were copied", async () => {
    const empty = mkdtempSync(join(tmpdir(), "none-"));
    dirs.push(empty);
    const { tool, writes } = fakeImageTool({});
    expect(
      await prepareTitleIcons({
        image: tool,
        sourcesDir: empty,
        mediaDir: empty,
      }),
    ).toEqual([]);
    expect(writes).toEqual([]);
  });

  it("stops when two icons would share one web name", async () => {
    const src = sourcesDir(["Title_X.png", "Title-X.png"]);
    const { tool } = fakeImageTool({
      "Title_X.png": [64, 64],
      "Title-X.png": [64, 64],
    });
    await expect(
      prepareTitleIcons({ image: tool, sourcesDir: src, mediaDir: src }),
    ).rejects.toThrow(/share the web name/);
  });

  it("names copies safely and uniquely per file", () => {
    expect(iconStem("Title_Civilian.png")).toBe("title-civilian-png");
    expect(iconStem("Farewell,_Port_Olisar.png")).toBe(
      "farewell-port-olisar-png",
    );
    expect(iconStem("Title_X.jpg")).not.toBe(iconStem("Title_X.png"));
  });
});
