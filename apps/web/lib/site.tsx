import type { ReactNode } from "react";
import { type NavSection, PageShell } from "ui";
import { repo } from "./data";
import { SEARCH_INDEX_PATH } from "./search-index";

export interface SiteProps {
  readonly children: ReactNode;
  readonly current?: NavSection | undefined;
  readonly stage?: ReactNode;
}

/**
 * Every route renders inside this: the shell with the current versions filled in and the search
 * index's address; the palette fetches the index on first use, so a page does not carry the
 * whole catalogue (ADR-022).
 */
export function Site({ children, current, stage }: SiteProps) {
  const r = repo();
  return (
    <PageShell
      searchIndexUrl={SEARCH_INDEX_PATH}
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
