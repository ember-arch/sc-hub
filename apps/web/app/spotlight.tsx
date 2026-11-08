import NextLink from "next/link";
import { Badge, type BadgeTone } from "ui";
import type { Picture } from "../lib/showcase";

/**
 * Home spotlights (ADR-010): the concept hero full-bleed in its key art with the cut-out layered
 * over it, and the live example as a wide feature. Both lead into the ship's own showcase page.
 */

const linkClass =
  "inline-flex items-center rounded-control px-4 py-2 text-ui no-underline transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

export function ConceptSpotlight({
  name,
  href,
  kicker,
  tagline,
  lead,
  background,
  cutout,
}: {
  readonly name: string;
  readonly href: string;
  readonly kicker: string;
  readonly tagline: string | null;
  readonly lead: string | null;
  readonly background: Picture;
  readonly cutout: Picture | null;
}) {
  return (
    <section
      aria-labelledby="spotlight-concept"
      className="showcase-hero relative isolate overflow-hidden"
    >
      <picture>
        <img
          src={background.src}
          srcSet={background.srcSet}
          sizes="100vw"
          width={background.width}
          height={background.height}
          alt={background.alt}
          fetchPriority="high"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
        />
      </picture>
      {cutout === null ? null : (
        <picture>
          <img
            src={cutout.src}
            srcSet={cutout.srcSet}
            sizes="(min-width: 768px) 110vw, 170vw"
            width={cutout.width}
            height={cutout.height}
            alt=""
            fetchPriority="high"
            className="showcase-cutout absolute -z-10 h-auto"
          />
        </picture>
      )}
      <div
        aria-hidden="true"
        className="showcase-fade absolute inset-x-0 bottom-0 -z-10"
      />
      <div className="flex min-h-[88svh] flex-col justify-end">
        <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 pb-12 md:pb-16">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="neutral">Concept spotlight</Badge>
            <span className="text-ui text-secondary">{kicker}</span>
          </div>
          <h2
            id="spotlight-concept"
            className="showcase-name m-0 text-hero text-primary md:text-marquee"
          >
            {name}
          </h2>
          {tagline === null ? null : (
            <p className="m-0 text-title text-primary">{tagline}</p>
          )}
          {lead === null ? null : (
            <p className="m-0 max-w-prose text-heading font-regular text-secondary">
              {lead}
            </p>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <NextLink
              href={href}
              className={`${linkClass} bg-accent text-page hover:opacity-90`}
            >
              Explore the {name}
            </NextLink>
            <NextLink
              href="/ships"
              className={`${linkClass} border border-hairline-strong text-primary hover:border-accent`}
            >
              All ships
            </NextLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LiveSpotlight({
  name,
  href,
  kicker,
  status,
  tagline,
  lead,
  image,
}: {
  readonly name: string;
  readonly href: string;
  readonly kicker: string;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly tagline: string | null;
  readonly lead: string | null;
  readonly image: Picture;
}) {
  return (
    <section
      aria-labelledby="spotlight-live"
      className="border-b border-hairline"
    >
      <div className="mx-auto grid w-full max-w-content items-center gap-8 px-4 py-16 md:grid-cols-12 md:py-24">
        <NextLink
          href={href}
          className="group block overflow-hidden rounded-card md:col-span-7 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          <img
            src={image.src}
            srcSet={image.srcSet}
            sizes="(min-width: 768px) 58vw, 100vw"
            width={image.width}
            height={image.height}
            alt={image.alt}
            loading="lazy"
            decoding="async"
            className="block aspect-video h-auto w-full object-cover transition-transform duration-hover group-hover:scale-[1.02]"
          />
        </NextLink>
        <div className="flex flex-col gap-4 md:col-span-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-ui text-secondary">{kicker}</span>
          </div>
          <h2 id="spotlight-live" className="m-0 text-hero text-primary">
            {name}
          </h2>
          {tagline === null ? null : (
            <p className="m-0 text-heading text-primary">{tagline}</p>
          )}
          {lead === null ? null : (
            <p className="m-0 text-body text-secondary">{lead}</p>
          )}
          <NextLink
            href={href}
            className={`${linkClass} self-start border border-hairline-strong text-primary hover:border-accent`}
          >
            See the {name}
          </NextLink>
        </div>
      </div>
    </section>
  );
}
