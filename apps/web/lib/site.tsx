import type { ReactNode } from "react";
import { type NavSection, PageShell } from "ui";
import { repo } from "./data";
import { currentRelease } from "./patch-page";
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
  // A LIVE version CIG has released ahead of the figures on record (ADR-049, amended): the strip
  // names it beside the build the figures are from.
  const ahead = currentRelease();
  const versions =
    ahead === null
      ? r.versions
      : r.versions.map((v) =>
          v.channel === "LIVE" ? { ...v, released: ahead.version } : v,
        );
  return (
    <PageShell
      searchIndexUrl={SEARCH_INDEX_PATH}
      versions={versions}
      current={current}
      stage={stage}
      wikiCredit={r.credit !== null}
    >
      {children}
    </PageShell>
  );
}

/**
 * A stable "now" for relative timestamps: the server's clock, rounded to the minute. Off Vercel,
 * `SITE_CLOCK` (an ISO time) pins it, so a local build can be photographed on a given day of a
 * show (ADR-057); a deployment always reads its own clock.
 */
export function now(): Date {
  const pinned =
    process.env["VERCEL"] === undefined ? process.env["SITE_CLOCK"] : undefined;
  const d =
    pinned === undefined || pinned.trim() === ""
      ? new Date()
      : new Date(pinned);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`SITE_CLOCK is not a time: ${JSON.stringify(pinned)}`);
  }
  d.setSeconds(0, 0);
  return d;
}
