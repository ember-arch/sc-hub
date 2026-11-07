import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec 00, criterion "Monorepo scaffold": every CLAUDE.md section 6 script exists, and the
// ones not yet implemented print "not implemented in Phase 0" and exit 1.

const runner = fileURLToPath(
  new URL("../not-implemented.mjs", import.meta.url),
);
const rootPackageJson = fileURLToPath(
  new URL("../../package.json", import.meta.url),
);

const expectedScripts = [
  "dev",
  "build",
  "test",
  "test:e2e",
  "lint",
  "typecheck",
  "db:migrate",
  "db:seed",
  "pipeline:detect",
  "pipeline:extract",
  "pipeline:normalize",
  "pipeline:models",
  "pipeline:publish",
  "pipeline:all",
  "workers:import",
  "workers:poll-news",
  "workers:poll-spectrum",
  "workers:link",
];

const scripts = (
  JSON.parse(readFileSync(rootPackageJson, "utf8")) as {
    scripts: Record<string, string>;
  }
).scripts;

const stubbed = Object.entries(scripts)
  .filter(([, command]) => command.includes("not-implemented.mjs"))
  .map(([name]) => name);

describe("root scripts", () => {
  it("has every script named in CLAUDE.md section 6", () => {
    expect(Object.keys(scripts).sort()).toEqual([...expectedScripts].sort());
  });

  it("passes each stub its own name", () => {
    for (const name of stubbed) {
      expect(scripts[name]).toBe(`node scripts/not-implemented.mjs ${name}`);
    }
  });
});

describe("scripts/not-implemented.mjs", () => {
  it.each(stubbed)(
    "%s exits 1 and says it is not implemented in Phase 0",
    (name) => {
      const result = spawnSync(process.execPath, [runner, name], {
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("not implemented in Phase 0");
      expect(result.stderr).toContain(`pnpm ${name}`);
      expect(result.stderr).toContain("docs/specs/");
    },
  );
});
