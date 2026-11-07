import NextLink from "next/link";

const TABS = [
  { href: "/news", label: "Feed" },
  { href: "/news/dev", label: "Dev tracker" },
] as const;

/** The news feed and the dev tracker are tabs of one section (system.md section 4). */
export function NewsTabs({
  current,
}: {
  readonly current: "/news" | "/news/dev";
}) {
  return (
    <nav
      aria-label="News sections"
      className="flex gap-4 border-b border-hairline text-ui"
    >
      {TABS.map((tab) => (
        <NextLink
          key={tab.href}
          href={tab.href}
          aria-current={current === tab.href ? "page" : undefined}
          className={`-mb-px border-b-2 px-1 pb-2 no-underline ${current === tab.href ? "border-accent text-primary" : "border-transparent text-secondary hover:text-primary"}`}
        >
          {tab.label}
        </NextLink>
      ))}
    </nav>
  );
}
