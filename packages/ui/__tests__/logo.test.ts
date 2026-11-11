import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LOGO_FILES } from "../components/logo";
import { color } from "../tokens";

// ADR-045: the logo's files carry the tokens' coppers and the page's ink per scheme, the favicon
// the light coppers, and the coppers are the logo's alone.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const pub = (path: string): string => read(`../../../apps/web/public${path}`);

describe("the Coppercork logo", () => {
  it("draws each scheme's lockup in that scheme's coppers and ink, and names itself", () => {
    for (const scheme of ["light", "dark"] as const) {
      const svg = pub(LOGO_FILES[scheme]);
      expect(svg, scheme).toContain(`fill="${color[scheme]["brand.copper"]}"`);
      expect(svg, scheme).toContain(`fill="${color[scheme]["brand.flame"]}"`);
      expect(svg, scheme).toContain(`fill="${color[scheme]["text.primary"]}"`);
      expect(svg, scheme).toContain("<title>Coppercork</title>");
      // Nothing but the four paths: no raster, no script, no font.
      expect(svg, scheme).not.toMatch(/<image|<script|<text|@font-face/);
    }
  });

  it("makes the favicon the cork alone, in the light coppers", () => {
    const icon = read("../../../apps/web/app/icon.svg");
    expect(icon).toContain(`fill="${color.light["brand.copper"]}"`);
    expect(icon).toContain(`fill="${color.light["brand.flame"]}"`);
    expect(icon.match(/<path/g)).toHaveLength(2);
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
