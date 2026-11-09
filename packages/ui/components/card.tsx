import NextLink from "next/link";
import { formatNumber } from "./format";
import type { ResponsiveImage } from "./media";

export interface CardStat {
  readonly label: string;
  readonly value: number | string | null;
  readonly unit?: string | undefined;
}

export interface CardProps {
  readonly href: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly role: string | null;
  /** Two stats (system.md section 3). */
  readonly stats: readonly [CardStat, CardStat] | readonly CardStat[];
  /** The card shows no credit line; the page it links to credits the image (ADR-009). */
  readonly image?: ResponsiveImage | null | undefined;
  /**
   * "lazy" (the default) waits until the card nears the screen. "eager" is for a list's first row,
   * on screen at once; "high" for the first card, usually the page's largest paint.
   */
  readonly imageLoading?: "lazy" | "eager" | "high" | undefined;
}

/** Ship card: image, name, manufacturer, role, two stats. The whole card is the link. */
export function Card({
  href,
  name,
  manufacturer,
  role,
  stats,
  image,
  imageLoading = "lazy",
}: CardProps) {
  return (
    <NextLink
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-card bg-surface shadow-soft no-underline transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {/* No image, no well: an empty box is chrome the reader could lose (design review, ADR-006). */}
      {image === undefined || image === null ? null : (
        // Inside <picture> React adds no preload hint, so a page that merely links to this list
        // (the nav does, everywhere) does not download its images when it prefetches it.
        <picture>
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading={imageLoading === "lazy" ? "lazy" : "eager"}
            fetchPriority={imageLoading === "high" ? "high" : undefined}
            decoding="async"
            className="block aspect-video h-auto w-full object-cover"
          />
        </picture>
      )}
      {/* The art runs to the card's edges (ADR-019); the words sit in their own padded block. */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <p className="font-display text-heading text-primary group-hover:text-accent">
            {name}
          </p>
          <p className="text-caption text-secondary">
            {manufacturer}
            {role !== null ? ` · ${role}` : ""}
          </p>
        </div>
        <dl className="m-0 mt-auto grid grid-cols-2 gap-2 border-t border-hairline pt-3">
          {stats.slice(0, 2).map((stat) => (
            <div key={stat.label} className="flex flex-col">
              <dt className="text-caption text-secondary">{stat.label}</dt>
              <dd className="m-0 font-mono text-ui text-primary">
                {stat.value === null ? (
                  <span className="text-secondary">—</span>
                ) : (
                  <>
                    {typeof stat.value === "number"
                      ? formatNumber(stat.value)
                      : stat.value}
                    {stat.unit !== undefined ? (
                      <span className="font-sans text-caption text-secondary">
                        {" "}
                        {stat.unit}
                      </span>
                    ) : null}
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </NextLink>
  );
}
