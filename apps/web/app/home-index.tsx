import NextLink from "next/link";
import { Badge, type BadgeTone } from "ui";
import type { Picture } from "../lib/showcase";
import { FramedArt } from "./ships/[slug]/showcase/dossier";

/**
 * The dossier index (ADR-011): the home page as a register of files. Featured files for the
 * concept hero and the live example. The register of every ship is in home-register.tsx.
 */

export interface FileFact {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
}

export function FeaturedFile({
  file,
  name,
  href,
  kicker,
  status,
  tagline,
  background,
  cutout,
  facts,
  priority,
}: {
  readonly file: string;
  readonly name: string;
  readonly href: string;
  readonly kicker: string;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly tagline: string | null;
  readonly background: Picture | null;
  readonly cutout: Picture | null;
  readonly facts: readonly FileFact[];
  readonly priority: boolean;
}) {
  return (
    <article
      aria-labelledby={`file-${file}`}
      className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3 text-caption">
        <span className="font-mono text-secondary">
          File <span className="text-primary">{file}</span>
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {background === null ? null : (
        <NextLink
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="block"
        >
          <FramedArt
            background={background}
            cutout={cutout}
            sizes="(min-width: 768px) 45vw, 100vw"
            priority={priority}
          />
        </NextLink>
      )}
      <div className="flex flex-col gap-1">
        <p className="m-0 text-caption text-secondary">{kicker}</p>
        <h2 id={`file-${file}`} className="m-0 text-title text-primary">
          <NextLink
            href={href}
            className="text-primary no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {name}
          </NextLink>
        </h2>
        {tagline === null ? null : (
          <p className="m-0 text-ui text-secondary">{tagline}</p>
        )}
      </div>
      <dl className="m-0 mt-auto grid grid-cols-3 gap-2 border-t border-hairline pt-3">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col">
            <dt className="text-caption text-secondary">{f.label}</dt>
            <dd className="m-0 font-mono text-ui text-primary">
              {f.value}
              {f.unit === undefined ? null : (
                <span className="font-sans text-caption text-secondary">
                  {" "}
                  {f.unit}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <NextLink
        href={href}
        className="self-start rounded-control border border-hairline-strong px-3 py-1 text-ui text-primary no-underline transition-colors duration-hover hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Open dossier
      </NextLink>
    </article>
  );
}
