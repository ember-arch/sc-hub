import NextLink from "next/link";
import type { ReactNode } from "react";
import type { ResponsiveImage } from "./media";

/**
 * A plate (ADR-020): a picture in a printed frame with a numbered caption and its credit. The
 * almanac never uses a picture as a background; every one is a plate. Without a picture on file
 * (a fresh clone, CI, a deployment: media is local, ADR-009) the frame holds the caption alone,
 * so the page keeps its shape and the caption's link still opens the entry.
 */

export type PlatePicture = Pick<
  ResponsiveImage,
  "src" | "srcSet" | "width" | "height" | "alt"
>;

export interface PlateProps {
  readonly picture: PlatePicture | null;
  /** "Plate I", "Plate II"… */
  readonly numeral: string;
  /** What the plate shows, as the caption's text; the caller links the name where it has an entry. */
  readonly caption: ReactNode;
  /** "Image: Roberts Space Industries"; omitted when there is no picture. */
  readonly credit?: string | undefined;
  /** The credit's source page; with one, the credit is a link that opens in a new tab. */
  readonly creditHref?: string | undefined;
  /** Where the picture itself links (the caption carries the visible link). */
  readonly href?: string | undefined;
  /** The frame's shape: `wide` 2:1, `panorama` 16:7, `card` 16:9. */
  readonly aspect: "wide" | "panorama" | "card";
  readonly sizes: string;
  readonly priority?: boolean | undefined;
}

const ASPECT = {
  wide: "aspect-[2/1]",
  panorama: "aspect-[16/7]",
  card: "aspect-video",
} as const;

export function Plate({
  picture,
  numeral,
  caption,
  credit,
  creditHref,
  href,
  aspect,
  sizes,
  priority = false,
}: PlateProps) {
  const image =
    picture === null ? null : (
      <img
        src={picture.src}
        srcSet={picture.srcSet}
        sizes={sizes}
        width={picture.width}
        height={picture.height}
        alt={picture.alt}
        fetchPriority={priority ? "high" : undefined}
        loading={priority ? undefined : "lazy"}
        decoding="async"
        className={`block h-auto w-full object-cover ${ASPECT[aspect]}`}
      />
    );
  return (
    <figure className="m-0 flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-soft">
      {image === null ? null : href === undefined ? (
        image
      ) : (
        // The caption carries the readable link; the picture repeats it for the pointer.
        <NextLink
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="block"
        >
          {image}
        </NextLink>
      )}
      <figcaption
        className={`mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-surface px-3 py-2 text-caption text-secondary ${image === null ? "" : "border-t border-hairline"}`}
      >
        <span>
          <span className="font-medium text-primary">{numeral}.</span> {caption}
        </span>
        {credit === undefined || image === null ? null : creditHref ===
          undefined ? (
          <span className="lab text-muted">{credit}</span>
        ) : (
          <a
            href={creditHref}
            target="_blank"
            rel="noopener noreferrer"
            className="lab rounded-control text-muted no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {credit}
          </a>
        )}
      </figcaption>
    </figure>
  );
}
