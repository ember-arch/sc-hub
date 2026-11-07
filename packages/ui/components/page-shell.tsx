import NextLink from "next/link";
import type { ReactNode } from "react";
import { SITE_NAME } from "../brand";
import { CommandPalette, type SearchEntry } from "./command-palette";
import { Footer } from "./footer";
import type { ChannelVersion } from "./patch-strip";

export type NavSection = "ships" | "components" | "news";

const NAV: readonly { section: NavSection; label: string; href: string }[] = [
  { section: "ships", label: "Ships", href: "/ships" },
  { section: "components", label: "Components", href: "/components" },
  { section: "news", label: "News", href: "/news" },
];

export interface PageShellProps {
  readonly children: ReactNode;
  readonly searchEntries: readonly SearchEntry[];
  readonly versions: readonly ChannelVersion[];
  readonly current?: NavSection | undefined;
  /** Ship pages default to dark (system.md principle 3); everything else follows the system. */
  readonly theme?: "light" | "dark" | undefined;
  readonly wikiCredit?: boolean | undefined;
}

/** Top nav (Ships, Components, News), search button, theme follows system; footer on every page. */
export function PageShell({
  children,
  searchEntries,
  versions,
  current,
  theme,
  wikiCredit = true,
}: PageShellProps) {
  return (
    <div
      data-theme={theme}
      className="flex min-h-dvh flex-col bg-page text-primary"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-raised focus:px-3 focus:py-2 focus:text-ui focus:text-primary"
      >
        Skip to content
      </a>
      <header className="border-b border-hairline">
        <div className="mx-auto flex w-full max-w-content items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <NextLink
              href="/"
              className="text-ui font-medium text-primary no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {SITE_NAME}
            </NextLink>
            <nav aria-label="Primary" className="flex items-center gap-4">
              {NAV.map((item) => (
                <NextLink
                  key={item.section}
                  href={item.href}
                  aria-current={current === item.section ? "page" : undefined}
                  className={`rounded-control text-ui no-underline transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${current === item.section ? "text-primary" : "text-secondary"}`}
                >
                  {item.label}
                </NextLink>
              ))}
            </nav>
          </div>
          <CommandPalette entries={searchEntries} />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-content flex-1 px-4 pb-8">
        {children}
      </main>
      <Footer versions={versions} wikiCredit={wikiCredit} />
    </div>
  );
}
