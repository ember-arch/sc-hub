import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT } from "../lib/data";
import config from "../next.config";

// ADR-057, amended 2026-11-15: Vercel rebuilds the front page and the event pages each minute,
// in a function that holds only the files traced into it, and a fixture missing there reads as
// absent (an empty list, no show), in silence. So every fixture the site's code names must be
// carried by every function, the patch snapshots excepted: they go to the routes that read them.
// With TRACE_BUILD=1 (CI, after the build) the build's own trace files are checked too.

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

interface Named {
  readonly file: string;
  /** Under fixtures/: "funding/Counter.json", "schema/x.json" for a template, "events" for a folder. */
  readonly path: string;
  readonly dir: boolean;
}

/**
 * Every `join(REPO_ROOT, "fixtures", …)` across the site's code. A call whose parts are not all
 * string literals (or templates) is reported as unreadable rather than skipped, so a read cannot
 * slip past the guard.
 */
function scan(): { named: Named[]; unreadable: string[] } {
  const start = /join\(\s*REPO_ROOT\s*,\s*["'`]fixtures["'`]/g;
  const whole =
    /^join\(\s*REPO_ROOT\s*,\s*"fixtures"\s*((?:,\s*(?:"[^"]*"|`[^`]*`)\s*)*),?\s*\)/;
  const arg = /"([^"]*)"|`([^`]*)`/g;
  const named: Named[] = [];
  const unreadable: string[] = [];
  const files = [
    ...sources(join(WEB, "lib")),
    ...sources(join(WEB, "app")),
    ...sources(join(REPO_ROOT, "packages", "ui")),
  ];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const where = relative(REPO_ROOT, file).split("\\").join("/");
    for (const hit of text.matchAll(start)) {
      const m = whole.exec(text.slice(hit.index));
      if (m === null) {
        unreadable.push(where);
        continue;
      }
      const parts = [...(m[1] ?? "").matchAll(arg)].map(
        (a) => a[1] ?? (a[2] ?? "").replace(/\$\{[^}]*\}/g, "x"),
      );
      named.push({
        file: where,
        path: parts.join("/"),
        dir: parts.length <= 1,
      });
    }
  }
  return { named, unreadable };
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

/** A folder counts only under a wildcard for its files ("events/*.json", "bootstrap/**"). */
const covered = (globs: string[], named: Pick<Named, "path" | "dir">) =>
  named.dir
    ? globs.some((g) => new RegExp(`^${named.path}/(\\*\\*|\\*[^/]*)$`).test(g))
    : globs.some((g) => globMatches(g, named.path));

describe("the files a rebuilt page reads", () => {
  const { named, unreadable } = scan();

  it("finds every fixture the site names, and reads each call", () => {
    expect(unreadable).toEqual([]);
    expect(named.map((n) => n.path)).toEqual(
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

/** The data files on disk a named path stands for: the file itself, or a folder's data files. */
function onDisk(n: Named): string[] {
  const path = join(REPO_ROOT, "fixtures", n.path);
  if (!n.dir) return n.path.includes("/x.") || !existsSync(path) ? [] : [path];
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((e) => e.isFile() && /\.json(\.gz)?$/.test(e.name))
    .map((e) => join(path, e.name));
}

const built = join(WEB, ".next", "server", "app");
const traced = (nft: string): Set<string> => {
  const file = join(built, nft);
  const { files } = JSON.parse(readFileSync(file, "utf8")) as {
    files: string[];
  };
  return new Set(files.map((f) => resolve(dirname(file), f)));
};

describe.runIf(process.env["TRACE_BUILD"] === "1")(
  "the build's trace of the pages Vercel rebuilds",
  () => {
    const { named } = scan();
    const routes = [
      { nft: "page.js.nft.json", patches: true },
      { nft: "events/page.js.nft.json", patches: false },
      { nft: join("events", "[slug]", "page.js.nft.json"), patches: false },
      { nft: "api/cron/changeover/route.js.nft.json", patches: false },
    ];
    it.each(routes)("$nft carries every fixture the site names", (route) => {
      const have = traced(route.nft);
      const missing = named
        .filter((n) => route.patches || n.path !== "patches")
        .flatMap(onDisk)
        .filter((path) => !have.has(path))
        .map((path) => relative(REPO_ROOT, path));
      expect(missing).toEqual([]);
    });
  },
);
