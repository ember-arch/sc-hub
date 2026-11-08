import type { ReactNode } from "react";
import { Badge, type BadgeTone, type MakerMark, Mark, TextLink } from "ui";
import type { Picture } from "../../../../lib/showcase";

/**
 * The showcase hero (ADR-010): the ship's key art full-bleed at viewport height, its transparent
 * cut-out layered over it where CIG publishes one, and the name set in the marquee size over the
 * dark lower part of the art. The art fades into the page at the bottom so the text and what follows
 * read on it; nothing is drawn over the ship itself. Without art (a clone, CI) the same text stands
 * on the page colour alone.
 */

export interface ShowcaseHeroProps {
  readonly name: string;
  readonly maker: { readonly name: string; readonly href: string } | null;
  readonly role: string | null;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly mark: MakerMark | null;
  readonly background: Picture | null;
  readonly cutout: Picture | null;
  /** The article's opening heading, sentence case: "The allfather of war". */
  readonly tagline: string | null;
  readonly lead: string | null;
  readonly credit: { readonly text: string; readonly href: string } | null;
  /** Compare controls and the like, under the lead. */
  readonly children?: ReactNode;
}

export function ShowcaseHero({
  name,
  maker,
  role,
  status,
  mark,
  background,
  cutout,
  tagline,
  lead,
  credit,
  children,
}: ShowcaseHeroProps) {
  const text = (
    <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 pb-12 md:pb-16">
      {mark === null ? null : <Mark mark={mark} heightClass="h-12" />}
      <p className="m-0 text-ui text-secondary">
        {maker === null ? null : (
          <TextLink href={maker.href}>{maker.name}</TextLink>
        )}
        {role === null ? null : <> · {role}</>}
      </p>
      <h1
        id="ship-name"
        className="showcase-name m-0 text-hero text-primary md:text-marquee"
      >
        {name}
      </h1>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={status.tone}>{status.label}</Badge>
        {tagline === null ? null : (
          <span className="text-heading text-primary">{tagline}</span>
        )}
      </div>
      {lead === null ? null : (
        <p className="m-0 max-w-prose text-heading font-regular text-secondary">
          {lead}
        </p>
      )}
      {children}
    </div>
  );

  if (background === null) {
    return (
      <section
        aria-labelledby="ship-name"
        className="border-b border-hairline pt-24"
      >
        {text}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="ship-name"
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
      <div className="flex min-h-[100svh] flex-col justify-end">{text}</div>
      {credit === null ? null : (
        <p className="absolute right-4 top-4 m-0 text-caption text-secondary">
          <TextLink href={credit.href} external className="text-secondary">
            {credit.text}
          </TextLink>
        </p>
      )}
    </section>
  );
}
