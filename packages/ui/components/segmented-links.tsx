import NextLink from "next/link";

export interface SegmentedLink {
  readonly href: string;
  readonly label: string;
}

export interface SegmentedLinksProps {
  readonly label: string;
  readonly links: readonly SegmentedLink[];
  /** The href of the current segment. */
  readonly current: string;
}

/**
 * A row of links that reads as one control (the card/table toggle on the ships index). Links, not
 * buttons: the choice is URL state, so it survives reload and sharing and needs no JavaScript.
 */
export function SegmentedLinks({ label, links, current }: SegmentedLinksProps) {
  return (
    <nav
      aria-label={label}
      className="inline-flex rounded-control border border-hairline bg-surface p-1 text-ui"
    >
      {links.map((link) => {
        const active = link.href === current;
        return (
          <NextLink
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-control px-3 py-1 no-underline transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${active ? "bg-inset text-primary" : "text-secondary hover:text-primary"}`}
          >
            {link.label}
          </NextLink>
        );
      })}
    </nav>
  );
}
