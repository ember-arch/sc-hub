import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../lib/data";
import config from "../next.config";

// ADR-057, amended 2026-11-15: Vercel rebuilds the front page and the event pages each minute,
// in a function that holds only the files traced into it, and a fixture missing there reads as
// absent (an empty list, no show), in silence. So every fixture the site's code names must be
// carried by every function, the patch snapshots excepted: they go to the routes that read them.

const WEB = join(REPO_ROOT, "apps", "web");
const SKIP = new Set([
  "__tests__",
  "e2e",
  "node_modules",
  ".next",
  "generated",
  "public",
]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** `join(REPO_ROOT, "fixtures", …)` across the site's code, as paths under fixtures/. */
function namedFixtures(): { file: string; path: string; dir: boolean }[] {
  const call =
    /join\(\s*REPO_ROOT\s*,\s*"fixtures"\s*((?:,\s*(?:"[^"]*"|`[^`]*`)\s*)*),?\s*\)/g;
  const arg = /"([^"]*)"|`([^`]*)`/g;
  return [...sources(join(WEB, "lib")), ...sources(join(WEB, "app"))].flatMap(
    (file) =>
      [...readFileSync(file, "utf8").matchAll(call)].map((m) => {
        const parts = [...(m[1] ?? "").matchAll(arg)].map(
          (a) => a[1] ?? (a[2] ?? "").replace(/\$\{[^}]*\}/g, "x"),
        );
        return {
          file: relative(REPO_ROOT, file).split("\\").join("/"),
          path: parts.join("/"),
          dir: parts.length === 1,
        };
      }),
  );
}

const PREFIX = "../../fixtures/";
const includes = (key: string): string[] =>
  (config.outputFileTracingIncludes?.[key] ?? [])
    .filter((p) => p.startsWith(PREFIX))
    .map((p) => p.slice(PREFIX.length));

const globMatches = (glob: string, path: string): boolean =>
  new RegExp(
    `^${glob
      .split("**")
      .map((part) =>
        part
          .split("*")
          .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
          .join("[^/]*"),
      )
      .join(".*")}$`,
  ).test(path);

const covered = (globs: string[], named: { path: string; dir: boolean }) =>
  named.dir
    ? globs.some((g) => g.startsWith(`${named.path}/`))
    : globs.some((g) => globMatches(g, named.path));

describe("the files a rebuilt page reads", () => {
  const named = namedFixtures();

  it("finds the fixtures the site names", () => {
    const paths = named.map((n) => n.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "events",
        "rsi-media/sources.json",
        "funding/Counter.json",
        "bootstrap",
        "patches",
      ]),
    );
  });

  it("are carried by every function, the patch snapshots aside", () => {
    const every = includes("/**");
    const missing = named
      .filter((n) => n.path !== "patches")
      .filter((n) => !covered(every, n))
      .map((n) => `${n.path} (${n.file})`);
    expect(missing).toEqual([]);
  });

  it("puts the patch snapshots in the patch pages and the front page, whose featured ships read them", () => {
    const patches = { path: "patches", dir: true };
    expect(covered(includes("/patches/**"), patches)).toBe(true);
    expect(covered(includes("/"), patches)).toBe(true);
  });
});
