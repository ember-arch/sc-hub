import NextLink from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "../brand";
import { CommandPalette, type SearchEntry } from "./command-palette";
import { Footer } from "./footer";
import type { ChannelVersion } from "./patch-strip";

export type NavSection = "ships" | "components" | "titles" | "funding" | "news";

const NAV: readonly { section: NavSection; label: string; href: string }[] = [
  { section: "ships", label: "Ships", href: "/ships" },
  { section: "components", label: "Components", href: "/components" },
  { section: "titles", label: "Titles", href: "/titles" },
  { section: "funding", label: "Funding", href: "/funding" },
  { section: "news", label: "News", href: "/news" },
];

export interface PageShellProps {
  readonly children: ReactNode;
  readonly searchEntries: readonly SearchEntry[];
  readonly versions: readonly ChannelVersion[];
  readonly current?: NavSection | undefined;
  /** Ship pages default to dark (system.md principle 3); everything else follows the system. */
  readonly theme?: "light" | "dark" | undefined;
  /** Full-bleed content above the main column: the ship page's stage (ADR-008). */
  readonly stage?: ReactNode;
  readonly wikiCredit?: boolean | undefined;
}

/** Top nav (Ships, Components, Titles, Funding, News), search button, theme follows system; footer on every page. */
export function PageShell({
  children,
  searchEntries,
  versions,
  current,
  theme,
  stage,
  wikiCredit = true,
}: PageShellProps) {
  return (
    <div
      data-theme={theme}
      className="flex min-h-dvh flex-col bg-page text-primary"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-raised focus:px-3 focus:py-2 focus:text-ui focus:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Skip to content
      </a>
      {/* The running head (ADR-020): the site name and the sections as small labels over a rule, the search field at the right. On a phone the nav takes its own row (ADR-017). */}
      <header className="border-b border-hairline-strong">
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <NextLink
            href="/"
            className="lab whitespace-nowrap text-primary no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {SITE_NAME}
          </NextLink>
          <nav
            aria-label="Primary"
            className="lab order-last flex w-full items-center gap-6 md:order-none md:w-auto md:flex-1 md:justify-center"
          >
            {NAV.map((item) => (
              <NextLink
                key={item.section}
                href={item.href}
                aria-current={current === item.section ? "page" : undefined}
                className={`rounded-control no-underline transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${current === item.section ? "font-medium text-accent underline underline-offset-4" : "text-secondary"}`}
              >
                {item.label}
              </NextLink>
            ))}
          </nav>
          <CommandPalette entries={searchEntries} />
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
