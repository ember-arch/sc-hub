import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { EmptyState, Section, TextLink } from "ui";
import { REPO_ROOT } from "../../lib/data";
import { Site } from "../../lib/site";

export const metadata: Metadata = { title: "Licenses" };

interface LicenseRow {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly homepage: string | null;
}

const GENERATED = join(REPO_ROOT, "apps", "web", "generated", "licenses.json");

/** Generated at build from package metadata (docs/legal/attribution.md) by apps/web/scripts/licenses.ts. */
function readLicenses(): readonly LicenseRow[] | null {
  if (!existsSync(GENERATED)) return null;
  const parsed: unknown = JSON.parse(readFileSync(GENERATED, "utf8"));
  return Array.isArray(parsed) ? (parsed as LicenseRow[]) : null;
}

export default function LicensesPage() {
  const rows = readLicenses();
  const groups =
    rows === null
      ? []
      : [...new Set(rows.map((r) => r.license))].sort().map((license) => ({
          license,
          rows: rows.filter((r) => r.license === license),
        }));
  return (
    <Site>
      <div className="flex flex-col gap-12 pt-8">
        <div className="flex max-w-prose flex-col gap-4">
          <h1 className="text-title text-primary">Licenses</h1>
          <p className="text-body text-secondary">
            Open-source libraries the site is built from, read from package
            metadata at build time.
          </p>
        </div>
        {rows === null ? (
          <EmptyState>
            The license list has not been generated for this build. Run pnpm
            --filter web licenses:generate.
          </EmptyState>
        ) : (
          groups.map((g) => (
            <Section
              key={g.license}
              id={g.license.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}
              title={g.license}
              aside={`${g.rows.length}`}
            >
              <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-1 p-0 text-ui text-secondary md:grid-cols-2 lg:grid-cols-3">
                {g.rows.map((r) => (
                  <li
                    key={`${r.name}@${r.version}`}
                    className="flex items-baseline gap-2"
                  >
                    {r.homepage === null ? (
                      <span>{r.name}</span>
                    ) : (
                      <TextLink href={r.homepage} external>
                        {r.name}
                      </TextLink>
                    )}
                    <span className="font-mono text-caption text-secondary">
                      {r.version}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ))
        )}
      </div>
    </Site>
  );
}
