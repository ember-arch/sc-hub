import type { ReactNode } from "react";

/**
 * The masthead (ADR-020): what every index page opens on, in the shell's full-bleed `stage` slot.
 * A label line of facts in the mono, the title in the display face, a one-line deck, and the
 * page's control on the right, over a rule. No art behind it: in the almanac, pictures are
 * plates with captions, never backgrounds.
 */
export function Masthead({
  eyebrow,
  title,
  lede,
  aside,
}: {
  readonly eyebrow: readonly ReactNode[];
  readonly title: string;
  readonly lede: string;
  readonly aside?: ReactNode;
}) {
  return (
    <div className="border-b border-hairline-strong">
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 pb-6 pt-8 md:pb-8 md:pt-12">
        <p className="lab m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-secondary">
          {eyebrow.map((item, i) => (
            <span key={i} className="flex items-baseline gap-x-3">
              {i > 0 ? <span aria-hidden="true">·</span> : null}
              {item}
            </span>
          ))}
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-prose flex-col gap-2">
            <h1 className="m-0 text-display text-primary md:text-hero">
              {title}
            </h1>
            {lede === "" ? null : (
              <p className="m-0 text-body text-secondary">{lede}</p>
            )}
          </div>
          {aside === undefined ? null : <div className="shrink-0">{aside}</div>}
        </div>
      </div>
    </div>
  );
}
