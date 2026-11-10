import NextLink from "next/link";

/** A filter chip on the news pages: a link, the active one marked. */
export function Chip({
  href,
  active,
  label,
}: {
  readonly href: string;
  readonly active: boolean;
  readonly label: string;
}) {
  return (
    <NextLink
      href={href}
      aria-current={active ? "true" : undefined}
      className={`rounded-pill border px-3 py-1 text-caption font-medium no-underline ${active ? "border-accent bg-accent-bg text-primary" : "border-hairline-strong bg-surface text-secondary hover:text-primary"}`}
    >
      {label}
    </NextLink>
  );
}
