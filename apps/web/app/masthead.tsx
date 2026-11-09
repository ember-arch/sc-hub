import type { ReactNode } from "react";
import { RSI_IMAGE_CREDIT } from "ui/legal";
import type { Picture } from "../lib/showcase";

/**
 * The masthead (ADR-019): what every index page opens on, in the shell's full-bleed `stage` slot.
 * A mono eyebrow of facts, the title in `display`, a one-line lede, and the page's controls on
 * the right. With art, CIG's key art runs full-bleed behind it under a scrim that keeps the text
 * legible (the one gradient allowed, ADR-014), credited in the corner; without art (CI, a deploy
 * before CIG's approval) the same masthead stands on the page colour.
 */
export function Masthead({
  eyebrow,
  title,
  lede,
  aside,
  art,
  priority = true,
}: {
  readonly eyebrow: readonly ReactNode[];
  readonly title: string;
  readonly lede: string;
  readonly aside?: ReactNode;
  readonly art?: Picture | null | undefined;
  readonly priority?: boolean;
}) {
  const withArt = art !== null && art !== undefined;
  return (
    <header
      className={`masthead relative isolate overflow-hidden border-b border-hairline ${withArt ? "masthead-art" : ""}`}
    >
      {withArt ? (
        <>
          <picture>
            <img
              src={art.src}
              srcSet={art.srcSet}
              sizes="100vw"
              width={art.width}
              height={art.height}
              alt=""
              fetchPriority={priority ? "high" : undefined}
              loading={priority ? undefined : "lazy"}
              decoding="async"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
          </picture>
          <div
            aria-hidden="true"
            className="masthead-scrim absolute inset-0 -z-10"
          />
          <p className="absolute bottom-3 right-4 m-0 text-caption text-muted">
            {RSI_IMAGE_CREDIT.text}
          </p>
        </>
      ) : null}
      <div
        className={`mx-auto flex w-full max-w-content flex-col gap-6 px-4 ${withArt ? "py-16 md:py-24" : "py-8 md:py-12"}`}
      >
        <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-caption text-secondary">
          {eyebrow.map((item, i) => (
            <span key={i} className="flex items-baseline gap-x-3">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {item}
            </span>
          ))}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-prose flex-col gap-3">
            <h1 className="masthead-title m-0 text-display text-primary">
              {title}
            </h1>
            <span aria-hidden="true" className="block h-1 w-12 bg-accent" />
            <p className="m-0 text-body text-secondary">{lede}</p>
          </div>
          {aside === undefined ? null : <div className="shrink-0">{aside}</div>}
        </div>
      </div>
    </header>
  );
}
