import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderTokensCss } from "../build/tokens-css";
import { contrast } from "../contrast";
import {
  color,
  colorTokens,
  colorUtility,
  cssName,
  layout,
  motion,
  radius,
  shadow,
  space,
  type,
  typeTokens,
  weight,
} from "../tokens";

// Spec 00, criterion "Design tokens": tokens.ts holds every value in docs/design/system.md
// section 2, and the Tailwind theme is generated from it. The first suite reads the design
// document's own tables, so a value edited in one place and not the other fails here.

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const systemMd = read("../../../docs/design/system.md");
const section = (from: string, to: string): string => {
  const start = systemMd.indexOf(from);
  const end = systemMd.indexOf(to, start + from.length);
  if (start < 0 || end < 0) throw new Error(`section ${from} not found`);
  return systemMd.slice(start, end);
};

/** Backticked values of each cell of a markdown table row. */
const cells = (row: string): string[][] =>
  row
    .split("|")
    .slice(1, -1)
    .map((cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? ""));

const tableRows = (text: string): string[] =>
  text
    .split("\n")
    .filter((line) => line.startsWith("| `"))
    .filter((line) => !line.startsWith("| Token"));

describe("tokens.ts matches docs/design/system.md section 2", () => {
  it("color: every token, both schemes, and nothing extra", () => {
    const documented = new Map<string, { light: string; dark: string }>();
    for (const row of tableRows(section("### Color", "### Type"))) {
      const [names = [], lights = [], darks = []] = cells(row);
      names.forEach((name, i) => {
        documented.set(name, { light: lights[i] ?? "", dark: darks[i] ?? "" });
      });
    }
    expect([...documented.keys()].sort()).toEqual([...colorTokens].sort());
    for (const [name, values] of documented) {
      const token = name as (typeof colorTokens)[number];
      expect(color.light[token], `${name} light`).toBe(values.light);
      expect(color.dark[token], `${name} dark`).toBe(values.dark);
    }
  });

  it("type: size, line height and weight per token", () => {
    const rows = tableRows(section("### Type", "Faces:"));
    const documented = new Map<string, [number, number, number[]]>();
    for (const row of rows) {
      const [, name, sizeLine, weights] = row.split("|").map((c) => c.trim());
      const [size, line] = (sizeLine ?? "").split("/").map(Number);
      const ws = (weights ?? "").split("/").map((w) => Number(w.trim()));
      documented.set((name ?? "").replace(/`/g, ""), [
        size ?? 0,
        line ?? 0,
        ws,
      ]);
    }
    expect([...documented.keys()].sort()).toEqual([...typeTokens].sort());
    for (const [name, [size, line, weights]] of documented) {
      const token = name as (typeof typeTokens)[number];
      expect(type[token].size, `${name} size`).toBe(size);
      expect(type[token].line, `${name} line`).toBe(line);
      expect(type[token].weight, `${name} weight`).toBe(weights[0]);
      for (const w of weights) {
        expect(Object.values(weight), `${name} weight ${w}`).toContain(w);
      }
    }
  });

  it("space, radius, elevation, layout and motion", () => {
    const text = section("### Space, radius, elevation", "## 3. Components");
    const spacing = /Spacing scale: ([\d, ]+) px/.exec(text)?.[1] ?? "";
    expect(spacing.split(",").map((s) => Number(s.trim()))).toEqual([...space]);

    const radii =
      /Radius: (\d+) px controls, (\d+) px cards, (\d+) px the command palette/.exec(
        text,
      );
    expect([radius.control, radius.card, radius.palette]).toEqual(
      radii?.slice(1, 4).map(Number),
    );

    expect(text).toContain(`\`shadow.popover: ${shadow.popover}\``);
    expect(text).toContain(`Max content width ${layout.contentMaxWidth} px`);
    expect(text).toContain(
      `prose max ${layout.proseMaxWidth.replace("ch", " ch")}`,
    );

    const durations =
      /Durations: (\d+) ms \(hover, toggle\), (\d+) ms \(panel, palette\), (\d+) ms \(viewer camera preset\)/.exec(
        text,
      );
    expect([
      motion.duration.hover,
      motion.duration.panel,
      motion.duration.viewer,
    ]).toEqual(durations?.slice(1, 4).map(Number));
    expect(text).toContain(`Easing: \`${motion.easing}\``);
  });
});

describe("tokens.css is generated from tokens.ts", () => {
  const css = renderTokensCss();

  it("matches the committed file (run `pnpm --filter ui build:tokens` after editing tokens.ts)", () => {
    expect(read("../tokens.css")).toBe(css);
  });

  it("carries both schemes and resets Tailwind's defaults", () => {
    for (const token of colorTokens) {
      expect(css).toContain(`--${cssName(token)}: ${color.light[token]};`);
      expect(css).toContain(`--${cssName(token)}: ${color.dark[token]};`);
      expect(css).toContain(
        `--color-${colorUtility[token]}: var(--${cssName(token)});`,
      );
    }
    expect(new Set(Object.values(colorUtility)).size).toBe(colorTokens.length);
    expect(css).toContain("@theme inline {");
    for (const namespace of ["color", "text", "radius", "shadow", "font"]) {
      expect(css).toContain(`--${namespace}-*: initial;`);
    }
    expect(css).toContain("--spacing: initial;");
    expect(css).toContain('[data-theme="dark"] {');
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("font-variant-numeric: tabular-nums;");
  });

  it("exposes exactly the spacing scale as named spacing values", () => {
    const names = [...css.matchAll(/--spacing-([\d.]+): (\d+)px;/g)]
      .map((m) => ({ name: Number(m[1]), px: Number(m[2]) }))
      // --spacing-0 is the zero every inset-0 and top-0 needs, not part of the scale.
      .filter((n) => n.px > 0);
    expect(names.map((n) => n.px)).toEqual([...space]);
    for (const n of names) expect(n.name).toBe(n.px / 4);
  });
});

// system.md section 6: text at least 4.5:1 in both modes. Every color used for text (the text
// tokens, the accent for links, the semantic colors for badges and PTU deltas) against every
// background, so a token change that breaks the rule fails here rather than in a Lighthouse
// run that happens to use the other scheme (ADR-007).
describe("contrast", () => {
  const textColors = [
    "text.primary",
    "text.secondary",
    "text.muted",
    "accent",
    "success",
    "warning",
    "danger",
  ] as const;
  const backgrounds = [
    "bg.page",
    "bg.surface",
    "bg.raised",
    "bg.inset",
  ] as const;
  for (const scheme of ["light", "dark"] as const) {
    it(`every text color reads at 4.5:1 or more on every background, ${scheme}`, () => {
      for (const fg of textColors) {
        for (const bg of backgrounds) {
          expect(
            contrast(color[scheme][fg], color[scheme][bg]),
            `${fg} on ${bg}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }

  it("matches the WCAG reference points", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBe(1);
    expect(contrast("#767676", "#FFFFFF")).toBeCloseTo(4.54, 2);
  });
});

// accent.bg carries text where something is selected (the palette's active result, a pressed
// compare toggle, the news source chip); only text.primary sits on it.
describe("contrast on accent.bg", () => {
  for (const scheme of ["light", "dark"] as const) {
    it(`text.primary reads at 4.5:1 or more on accent.bg, ${scheme}`, () => {
      expect(
        contrast(color[scheme]["text.primary"], color[scheme]["accent.bg"]),
      ).toBeGreaterThanOrEqual(4.5);
    });
  }
});
