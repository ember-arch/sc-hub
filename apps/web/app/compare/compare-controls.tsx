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
      aria-label={`Compare ${name}`}
      title={full ? `Up to ${MAX_COMPARE} ships can be compared` : undefined}
      onClick={() => {
        if (!full) toggle(slug);
      }}
      className={`${button} ${pressed ? "border-accent bg-accent-bg text-primary" : full ? "border-hairline bg-surface text-secondary" : "border-hairline bg-surface text-primary hover:border-hairline-strong"}`}
    >
      {pressed ? "In compare" : "Add to compare"}
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
 * On the ships index (ADR-046): a bar pinned to the foot of the screen while the basket holds a
 * ship, so the way to the side-by-side page is in view wherever the ship was picked. A spacer
 * keeps the page's last lines clear of it.
 */
export function CompareTray() {
  const { slugs, set } = useCompareBasket();
  if (slugs.length === 0) return null;
  const more = MAX_COMPARE - slugs.length;
  return (
    <>
      <div aria-hidden="true" className="h-24" />
      <aside
        aria-label="Ships to compare"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-raised"
      >
        <div className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <p className="m-0 text-ui text-secondary" data-testid="compare-tray">
            {slugs.length === 1
              ? `1 ship picked: add up to ${more} more to see their stats side by side.`
              : `${slugs.length} of ${MAX_COMPARE} ships picked to see side by side.`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => set([])}
              className={`${button} border-hairline bg-surface text-primary hover:border-hairline-strong`}
            >
              Clear
            </button>
            <CompareLink />
          </div>
        </div>
      </aside>
    </>
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
