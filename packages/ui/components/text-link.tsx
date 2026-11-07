import NextLink from "next/link";
import type { ReactNode } from "react";

export interface TextLinkProps {
  readonly href: string;
  readonly children: ReactNode;
  /** Opens source sites in a new tab with rel noopener. */
  readonly external?: boolean | undefined;
  readonly className?: string | undefined;
}

const base =
  "text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent rounded-control";

/** The one link style. Internal links use next/link; external ones a plain anchor. */
export function TextLink({
  href,
  children,
  external,
  className,
}: TextLinkProps) {
  const cls = className === undefined ? base : `${base} ${className}`;
  if (external === true) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <NextLink href={href} className={cls}>
      {children}
    </NextLink>
  );
}
