import NextLink from "next/link";

type Tab = "/news" | "/news/dev" | "/news/videos";

const TABS: readonly { href: Tab; label: string; spectrum?: true }[] = [
  { href: "/news", label: "Dispatches" },
  { href: "/news/dev", label: "Developer gold posts", spectrum: true },
  { href: "/news/videos", label: "Videos" },
];

/**
 * The dispatches, the developer posts and the videos are tabs of one section (system.md section
 * 4): what CIG publishes on the first, what its developers say on Spectrum on the second
 * (ADR-029), CIG's YouTube uploads on the third (ADR-050). With the Spectrum module off
 * (`SPECTRUM_MODE=off`, spec 03) the tracker has nothing to show and its tab is not drawn.
 */
export function NewsTabs({
  current,
  devOn,
}: {
  readonly current: Tab;
  readonly devOn: boolean;
}) {
  return (
    <nav aria-label="News sections" className="flex gap-4 text-ui">
      {TABS.filter((tab) => devOn || tab.spectrum !== true).map((tab) => (
        <NextLink
          key={tab.href}
          href={tab.href}
          aria-current={current === tab.href ? "page" : undefined}
          className={`border-b px-1 pb-2 no-underline ${current === tab.href ? "border-accent text-primary" : "border-transparent text-secondary hover:text-primary"}`}
        >
          {tab.label}
        </NextLink>
      ))}
    </nav>
  );
}
