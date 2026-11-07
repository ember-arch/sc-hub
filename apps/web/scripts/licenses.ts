// Writes apps/web/generated/licenses.json from `pnpm licenses list` before dev and build, so the
// /licenses route is generated from package metadata (docs/legal/attribution.md, ADR-005).
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface PnpmLicenseEntry {
  readonly name: string;
  readonly versions: readonly string[];
  readonly license: string;
  readonly homepage?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const out = join(here, "..", "generated", "licenses.json");

// A fixed command string: pnpm is a .cmd shim on Windows, so it has to go through the shell.
const raw = execSync("pnpm licenses list --json --prod --filter web", {
  cwd: repoRoot,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const byLicense = JSON.parse(raw) as Record<
  string,
  readonly PnpmLicenseEntry[]
>;
const rows = Object.values(byLicense)
  .flat()
  .flatMap((entry) =>
    entry.versions.map((version) => ({
      name: entry.name,
      version,
      license: entry.license,
      homepage: entry.homepage ?? null,
    })),
  )
  .sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en") ||
      a.version.localeCompare(b.version, "en"),
  );

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);
console.log(
  JSON.stringify({ event: "web.licenses.written", count: rows.length, out }),
);
