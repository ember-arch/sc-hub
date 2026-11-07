import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "./badge";
import { Card, type CardProps } from "./card";
import { TextLink } from "./text-link";

/**
 * The one template every entity page uses (system.md principle 5): hero, key facts, body
 * sections, related entities. Pages compose it; it holds no data logic.
 */

export interface HeroImage {
  readonly src: string;
  readonly alt: string;
  /** For example "Image: CIG fankit." (docs/legal/attribution.md). */
  readonly caption?: string | undefined;
}

export interface HeroProps {
  readonly name: string;
  /** Small line above the name: manufacturer, item type, or nothing. */
  readonly kicker?:
    { readonly label: string; readonly href?: string | undefined } | undefined;
  readonly status?:
    { readonly tone: BadgeTone; readonly label: string } | undefined;
  /** One image or the viewer slot. null shows the placeholder panel (spec 00: fankit render placeholder). */
  readonly image?: HeroImage | null | undefined;
  /** Text inside the placeholder panel when there is no image. */
  readonly placeholder?: string | undefined;
  /** Manufacturer pages: a 3 px rule is the only place a brand color may appear (system.md section 2). */
  readonly brandRule?: boolean | undefined;
  readonly children?: ReactNode;
}

export function Hero({
  name,
  kicker,
  status,
  image,
  placeholder,
  brandRule,
  children,
}: HeroProps) {
  return (
    <header
      className={`flex flex-col gap-6 pt-8 md:flex-row md:items-end md:justify-between ${brandRule === true ? "border-t-[3px] border-hairline-strong" : ""}`}
    >
      <div className="flex min-w-0 flex-col gap-2">
        {kicker !== undefined ? (
          <p className="text-ui text-secondary">
            {kicker.href !== undefined ? (
              <TextLink href={kicker.href}>{kicker.label}</TextLink>
            ) : (
              kicker.label
            )}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display text-primary">{name}</h1>
          {status !== undefined ? (
            <Badge tone={status.tone}>{status.label}</Badge>
          ) : null}
        </div>
        {children}
      </div>
      {image === undefined ? null : image === null ? (
        <div
          className="flex aspect-video w-full items-center justify-center rounded-card border border-hairline bg-inset text-ui text-secondary md:w-1/2"
          role="img"
          aria-label={placeholder ?? "No image yet"}
        >
          {placeholder ?? "No image yet"}
        </div>
      ) : (
        <figure className="m-0 w-full md:w-1/2">
          <img
            src={image.src}
            alt={image.alt}
            className="aspect-video w-full rounded-card border border-hairline object-cover"
          />
          {image.caption !== undefined ? (
            <figcaption className="mt-1 text-caption text-secondary">
              {image.caption}
            </figcaption>
          ) : null}
        </figure>
      )}
    </header>
  );
}

export interface KeyFact {
  readonly label: string;
  /** null renders as an em dash. */
  readonly value: ReactNode | null;
  readonly unit?: string | undefined;
}

export interface KeyFactsProps {
  /** 4 to 8 pairs (system.md section 3). */
  readonly facts: readonly KeyFact[];
}

/** Reads in one glance at 390 px: two columns on phone, four on desktop. */
export function KeyFacts({ facts }: KeyFactsProps) {
  return (
    <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 rounded-card border border-hairline bg-surface p-4 md:grid-cols-4">
      {facts.map((fact) => (
        <div key={fact.label} className="flex flex-col gap-1">
          <dt className="text-caption text-secondary">{fact.label}</dt>
          <dd className="m-0 text-ui text-primary">
            {fact.value === null ? (
              <span className="text-secondary">—</span>
            ) : (
              <>
                <span
                  className={typeof fact.value === "number" ? "font-mono" : ""}
                >
                  {fact.value}
                </span>
                {fact.unit !== undefined ? (
                  <span className="text-caption text-secondary">
                    {" "}
                    {fact.unit}
                  </span>
                ) : null}
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface SectionProps {
  readonly id: string;
  readonly title: string;
  /** A short line beside the title: version, count, source. */
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}

export function Section({ id, title, aside, children }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-heading`} className="text-heading text-primary">
          {title}
        </h2>
        {aside !== undefined ? (
          <div className="text-caption text-secondary">{aside}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Empty states name the space and the next step (system.md section 5). */
export function EmptyState({ children }: { readonly children: ReactNode }) {
  return (
    <p className="rounded-card border border-hairline bg-inset px-4 py-6 text-center text-ui text-secondary">
      {children}
    </p>
  );
}

export interface RelatedGroup {
  readonly title: string;
  readonly items: readonly CardProps[];
}

export interface RelatedProps {
  readonly groups: readonly RelatedGroup[];
}

export function Related({ groups }: RelatedProps) {
  const shown = groups.filter((g) => g.items.length > 0);
  if (shown.length === 0) return null;
  return (
    <section aria-label="Related" className="flex flex-col gap-8">
      {shown.map((group) => (
        <div key={group.title} className="flex flex-col gap-4">
          <h2 className="text-heading text-primary">{group.title}</h2>
          <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
            {group.items.map((item) => (
              <li key={item.href}>
                <Card {...item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export interface EntityPageProps {
  readonly hero: HeroProps;
  readonly facts: readonly KeyFact[];
  readonly children?: ReactNode;
  readonly related?: readonly RelatedGroup[] | undefined;
}

export function EntityPage({
  hero,
  facts,
  children,
  related,
}: EntityPageProps) {
  return (
    <article className="flex flex-col gap-12">
      <Hero {...hero} />
      <KeyFacts facts={facts} />
      {children}
      {related !== undefined ? <Related groups={related} /> : null}
    </article>
  );
}
