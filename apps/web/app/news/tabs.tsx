import NextLink from "next/link";

const TABS = [
  { href: "/news", label: "Dispatches" },
  { href: "/news/dev", label: "Developer posts" },
] as const;

/**
 * The dispatches and the developer posts are tabs of one section (system.md section 4): what
 * CIG publishes on one, what its developers say on Spectrum on the other (ADR-029). With the
 * Spectrum module off (`SPECTRUM_MODE=off`, spec 03) the tracker has nothing to show and the
 * tabs are not drawn.
 */
export function NewsTabs({
  current,
  devOn,
}: {
  readonly current: "/news" | "/news/dev";
  readonly devOn: boolean;
}) {
  if (!devOn) return null;
  return (
    <nav aria-label="News sections" className="flex gap-4 text-ui">
      {TABS.map((tab) => (
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
