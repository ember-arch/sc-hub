import NextLink from "next/link";
import { formatNumber } from "./format";

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
  readonly image?:
    { readonly src: string; readonly alt: string } | null | undefined;
}

/** Ship card: image, name, manufacturer, role, two stats. The whole card is the link. */
export function Card({
  href,
  name,
  manufacturer,
  role,
  stats,
  image,
}: CardProps) {
  return (
    <NextLink
      href={href}
      className="group flex h-full flex-col gap-3 rounded-card border border-hairline bg-surface p-4 no-underline transition-colors duration-hover hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {image === undefined || image === null ? (
        <div
          className="aspect-video w-full rounded-control bg-inset"
          aria-hidden="true"
        />
      ) : (
        <img
          src={image.src}
          alt={image.alt}
          className="aspect-video w-full rounded-control object-cover"
        />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-ui font-medium text-primary group-hover:text-accent">
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
            <dt className="text-caption text-muted">{stat.label}</dt>
            <dd className="m-0 font-mono text-ui text-primary">
              {stat.value === null ? (
                <span className="text-muted">—</span>
              ) : (
                <>
                  {typeof stat.value === "number"
                    ? formatNumber(stat.value)
                    : stat.value}
                  {stat.unit !== undefined ? (
                    <span className="font-sans text-caption text-muted">
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
    </NextLink>
  );
}
