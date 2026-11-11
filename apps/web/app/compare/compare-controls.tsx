"use client";

import NextLink from "next/link";
import { useEffect } from "react";
import { MAX_COMPARE, compareHref } from "../../lib/compare";
import { useCompareBasket } from "../../lib/compare-store";

/**
 * Add and remove from the ship page and the index (spec 02, "Compare"). A toggle button per ship
 * with `aria-pressed`, and a link to the compare page carrying the basket as `?ships=`.
 */

const button =
  "rounded-pill border px-4 py-1 text-ui transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

export function CompareToggle({
  slug,
  name,
}: {
  readonly slug: string;
  readonly name: string;
}) {
  const { slugs, toggle } = useCompareBasket();
  const pressed = slugs.includes(slug);
  const full = !pressed && slugs.length >= MAX_COMPARE;
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-disabled={full}
      title={full ? `Up to ${MAX_COMPARE} ships can be compared` : undefined}
      onClick={() => {
        if (!full) toggle(slug);
      }}
      className={`${button} whitespace-nowrap ${pressed ? "border-accent bg-accent-bg text-primary" : full ? "border-hairline bg-surface text-secondary" : "border-hairline bg-surface text-primary hover:border-hairline-strong"}`}
    >
      {pressed ? "In compare" : "Add to compare"}
      {/* The ship's name completes the spoken label, which starts with the visible one (WCAG 2.5.3). */}
      <span className="sr-only"> {name}</span>
    </button>
  );
}

/** "Compare N ships" when the basket has at least one; renders nothing otherwise. */
export function CompareLink() {
  const { slugs } = useCompareBasket();
  if (slugs.length === 0) return null;
  return (
    <NextLink
      href={compareHref(slugs)}
      className={`${button} border-hairline bg-surface text-primary no-underline hover:border-hairline-strong`}
    >
      Compare {slugs.length} {slugs.length === 1 ? "ship" : "ships"}
    </NextLink>
  );
}

/**
 * On the ships index (ADR-046): a bar stuck to the foot of the screen while the basket holds a
 * ship, so the way to the side-by-side page is in view wherever the ship was picked. It is the
 * last thing in the page's main column and sticky, so at the end of the page it docks above the
 * footer instead of covering it. Its count is announced as it changes; Clear returns focus to the
 * page's heading.
 */
export function CompareTray() {
  const { slugs, set } = useCompareBasket();
  if (slugs.length === 0) return null;
  const more = MAX_COMPARE - slugs.length;
  return (
    <aside
      aria-label="Ships to compare"
      className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-hairline bg-raised"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <p
          className="m-0 text-ui text-secondary"
          data-testid="compare-tray"
          aria-live="polite"
        >
          {slugs.length === 1
            ? `1 ship picked: add up to ${more} more to see their stats side by side.`
            : `${slugs.length} of ${MAX_COMPARE} ships picked to see side by side.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              set([]);
              // The bar leaves with the picks; the heading keeps the reader's place.
              const heading = document.querySelector("h1");
              if (heading !== null) {
                heading.setAttribute("tabindex", "-1");
                heading.focus();
              }
            }}
            className={`${button} border-hairline bg-surface text-primary hover:border-hairline-strong`}
          >
            Clear picks
          </button>
          <NextLink
            href={compareHref(slugs)}
            className={`${button} border-accent bg-accent-bg text-primary no-underline`}
          >
            See them side by side
          </NextLink>
        </div>
      </div>
    </aside>
  );
}

/** On the compare page: the URL is the truth, so the basket follows it. */
export function SyncCompareBasket({
  slugs,
}: {
  readonly slugs: readonly string[];
}) {
  const { set } = useCompareBasket();
  const key = slugs.join(",");
  useEffect(() => {
    set(key === "" ? [] : key.split(","));
  }, [key, set]);
  return null;
}
