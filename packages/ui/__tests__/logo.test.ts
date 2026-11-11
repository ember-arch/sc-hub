import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MARK_PATH } from "../components/logo";
import { color } from "../tokens";

// ADR-041: the favicon is the mark's drawing in the token's light value, and the copper is the
// mark's alone.

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("the Coppercork mark", () => {
  it("is the favicon's drawing, in the token's light copper on the light ink", () => {
    const icon = read("../../../apps/web/app/icon.svg");
    expect(icon).toContain(`d="${MARK_PATH}"`);
    expect(icon).toContain(`fill="${color.light["brand.copper"]}"`);
    expect(icon).toContain(`fill="${color.light["text.primary"]}"`);
  });

  it("keeps the copper to the mark: no other component or page reads the token", () => {
    const roots = ["../components", "../stories", "../../../apps/web/app"];
    const offenders: string[] = [];
    for (const root of roots) {
      const dir = fileURLToPath(new URL(root, import.meta.url));
      for (const file of readdirSync(dir, { recursive: true })) {
        const name = String(file);
        if (!/\.(tsx?|css)$/.test(name) || name.endsWith("logo.tsx")) continue;
        const text = readFileSync(`${dir}/${name}`, "utf8");
        if (/brand-copper/.test(text)) offenders.push(name);
      }
    }
    expect(offenders).toEqual([]);
  });
});
