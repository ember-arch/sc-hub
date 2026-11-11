import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOGO_ASPECT, LOGO_FILES } from "../components/logo";
import { color } from "../tokens";

// ADR-045, ADR-047: the logo's files carry the board's coppers and the page's ink per scheme, the favicon
// is the lockup's own cork, and the coppers are the logo's alone.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const pub = (path: string): string => read(`../../../apps/web/public${path}`);
const paths = (svg: string): string[] =>
  [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1] ?? "");

describe("the Coppercork logo", () => {
  it("draws each scheme's lockup in the board's coppers and the page's ink, and names itself", () => {
    // The updated board (ADR-047): the plates one copper on both grounds; the flames darker on
    // light, lighter on dark.
    expect(color.light["brand.copper"]).toBe("#C97A40");
    expect(color.light["brand.flame"]).toBe("#B5652E");
    expect(color.dark["brand.copper"]).toBe("#C97A40");
    expect(color.dark["brand.flame"]).toBe("#E9A46E");
    for (const scheme of ["light", "dark"] as const) {
      const svg = pub(LOGO_FILES[scheme]);
      expect(svg, scheme).toContain(`fill="${color[scheme]["brand.copper"]}"`);
      expect(svg, scheme).toContain(`fill="${color[scheme]["brand.flame"]}"`);
      expect(svg, scheme).toContain(`fill="${color[scheme]["text.primary"]}"`);
      expect(svg, scheme).toContain("<title>Coppercork</title>");
      expect(svg, scheme).not.toMatch(/<image|<script|<text|@font-face/);
    }
  });

  it("gives Logo the files' own proportions, and both files the same drawing", () => {
    const [light, dark] = [pub(LOGO_FILES.light), pub(LOGO_FILES.dark)];
    const box = light.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(box).not.toBeNull();
    expect(Number(box![1]) / Number(box![2])).toBeCloseTo(LOGO_ASPECT, 5);
    expect(paths(light)).toEqual(paths(dark));
    // The plates, the flames and the wordmark (the revision has no rule over the word).
    expect(paths(light)).toHaveLength(3);
  });

  it("makes the favicon the lockup's cork, in the light board's coppers and the dark's on a dark tab", () => {
    const icon = read("../../../apps/web/app/icon.svg");
    const lockup = paths(pub(LOGO_FILES.light));
    expect(paths(icon)).toEqual(lockup.slice(0, 2));
    expect(icon).toContain(`.p{fill:${color.light["brand.copper"]}}`);
    expect(icon).toContain(`.f{fill:${color.light["brand.flame"]}}`);
    expect(icon).toMatch(
      new RegExp(
        `prefers-color-scheme:dark\\)\\{\\.p\\{fill:${color.dark["brand.copper"]}\\}\\.f\\{fill:${color.dark["brand.flame"]}`,
      ),
    );
  });

  it("keeps the coppers to the logo: no component or page reads them", () => {
    const roots = ["../components", "../stories", "../../../apps/web/app"];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = fileURLToPath(new URL(root, import.meta.url));
      for (const file of readdirSync(dir, { recursive: true })) {
        const name = String(file);
        if (!/\.(tsx?|css)$/.test(name)) continue;
        const text = readFileSync(`${dir}/${name}`, "utf8");
        if (/brand-(copper|flame)/.test(text)) offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});
