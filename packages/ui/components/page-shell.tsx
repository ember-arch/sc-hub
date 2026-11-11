import NextLink from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "../brand";
import { CommandPalette, type SearchEntry } from "./command-palette";
import { Footer } from "./footer";
import type { ChannelVersion } from "./patch-strip";
import { ThemeToggle } from "./theme-toggle";

export type NavSection = "ships" | "components" | "titles" | "news";

const NAV: readonly { section: NavSection; label: string; href: string }[] = [
  { section: "ships", label: "Ships", href: "/ships" },
  { section: "components", label: "Components", href: "/components" },
  { section: "titles", label: "Titles", href: "/titles" },
  { section: "news", label: "News", href: "/news" },
];

export interface PageShellProps {
  readonly children: ReactNode;
  /** The search index itself (stories), or where the palette fetches it on first use. */
  readonly searchEntries?: readonly SearchEntry[] | undefined;
  readonly searchIndexUrl?: string | undefined;
  readonly versions: readonly ChannelVersion[];
  readonly current?: NavSection | undefined;
  /** Full-bleed content above the main column: the ship entry's opening (ADR-020). */
  readonly stage?: ReactNode;
  readonly wikiCredit?: boolean | undefined;
}

/**
 * The shell (ADR-021): the brand, the sections as pills with the current one filled, the search
 * field as a pill and the theme switch at the right; the footer on every page. The scheme is the
 * reader's (the switch) or the system's; no page forces its own.
 */
export function PageShell({
  children,
  searchEntries,
  searchIndexUrl,
  versions,
  current,
  stage,
  wikiCredit = true,
}: PageShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-raised focus:px-3 focus:py-2 focus:text-ui focus:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Skip to content
      </a>
      <header>
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
          <NextLink
            href="/"
            className="whitespace-nowrap text-ui font-medium text-primary no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {SITE_NAME}
          </NextLink>
          {/* Below lg the nav takes its own row (ADR-017): the three do not fit in one. */}
          <nav
            aria-label="Primary"
            className="order-last flex w-full flex-wrap items-center gap-1 lg:order-none lg:w-auto lg:flex-1 lg:justify-center"
          >
            {NAV.map((item) => (
              <NextLink
                key={item.section}
                href={item.href}
                aria-current={current === item.section ? "page" : undefined}
                className={`rounded-pill px-3 py-1 text-ui font-medium no-underline transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${current === item.section ? "bg-primary text-page" : "text-secondary hover:bg-inset hover:text-primary"}`}
              >
                {item.label}
              </NextLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <CommandPalette entries={searchEntries} indexUrl={searchIndexUrl} />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {stage === undefined ? null : <div id="main">{stage}</div>}
      <main
        id={stage === undefined ? "main" : undefined}
        className="mx-auto w-full max-w-content flex-1 px-4 pb-8"
      >
        {children}
      </main>
      <Footer versions={versions} wikiCredit={wikiCredit} />
    </div>
  );
}
