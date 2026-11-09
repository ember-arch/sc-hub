import type { ReactNode } from "react";
import { type NavSection, PageShell } from "ui";
import { repo } from "./data";
import { titleCatalog, titleSearchEntries } from "./titles";

export interface SiteProps {
  readonly children: ReactNode;
  readonly current?: NavSection | undefined;
  readonly stage?: ReactNode;
}

/** Every route renders inside this: the shell with the search index and current versions filled in. */
export function Site({ children, current, stage }: SiteProps) {
  const r = repo();
  return (
    <PageShell
      searchEntries={[
        ...r.searchEntries,
        ...titleSearchEntries(titleCatalog()),
      ]}
      versions={r.versions}
      current={current}
      stage={stage}
      wikiCredit={r.credit !== null}
    >
      {children}
    </PageShell>
  );
}

/** A stable "now" for relative timestamps: the server's clock, rounded to the minute. */
export function now(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}
