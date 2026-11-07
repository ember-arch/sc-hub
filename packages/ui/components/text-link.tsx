import NextLink from "next/link";
import type { ReactNode } from "react";

export interface TextLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  /** Opens source sites in a new tab with rel noopener. */
  readonly external?: boolean | undefined;
  readonly className?: string | undefined;
  /** When the visible text is not enough on its own, for example a repeated "Remove". */
  readonly ariaLabel?: string | undefined;
}

const base =
  "text-accent underline underline-offset-4 decoration-hairline-strong hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-control";

/** The one link style. Internal links use next/link; external ones a plain anchor. */
export function TextLink({
  href,
  children,
  external,
  className,
  ariaLabel,
}: TextLinkProps) {
  const cls = className === undefined ? base : `${base} ${className}`;
  if (external === true) {
    return (
      <a
        href={href}
        className={cls}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }
  return (
    <NextLink href={href} className={cls} aria-label={ariaLabel}>
      {children}
    </NextLink>
  );
}
