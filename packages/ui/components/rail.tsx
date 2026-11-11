"use client";

import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/** How wide each card is, as a share of the rail: a peek of the next card always shows. */
export type RailSize = "video" | "post" | "plate";

const ITEM: Readonly<Record<RailSize, string>> = {
  // Five on a wide desktop, four on a laptop, two and a peek on a tablet, one and a peek on a phone.
  video: "basis-4/5 sm:basis-2/5 lg:basis-1/4 xl:basis-1/5",
  // Posts carry words: three across on a desktop.
  post: "basis-4/5 sm:basis-1/2 lg:basis-1/3",
  // Ship plates: one and a peek on a phone (the rail is phone-only for them).
  plate: "basis-4/5 sm:basis-1/2",
};

const GRID: Readonly<Record<2 | 3, string>> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

export interface RailProps {
  /** Names the rail for assistive technology, for example "Latest videos". */
  readonly label: string;
  readonly size: RailSize;
  /**
   * A rail on phones only, the given grid from tablet width (`md`) up: for sections whose
   * desktop layout already fits the screen, so only the phone's long column becomes a row.
   */
  readonly phoneOnly?: { readonly columns: 2 | 3 } | undefined;
  /** Each child is one card. */
  readonly children: ReactNode;
}

/**
 * A row of cards that scrolls sideways (ADR-050): the home page's sections as rails, so a phone
 * reader moves along a section with a swipe and down the page past it, instead of down five tall
 * cards per section. Scroll snapping lands each card at the edge; the next card always peeks in
 * so the row reads as one that continues. From tablet width two buttons page the row by its own
 * width (a jump, not a glide: CLAUDE.md section 7 keeps motion for viewer transitions), marked
 * unavailable at either end and hidden when the row fits; they are words ("Back", "More"), named
 * in full for assistive tech, since ADR-044 keeps icons beside labels, never in their place. Keyboard readers move through the cards' own links,
 * which scroll the row as they take focus. The row is a list named for its section, not a
 * landmark of its own.
 */
export function Rail({ label, size, phoneOnly, children }: RailProps) {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false, fits: false });

  const measure = useCallback(() => {
    const el = list.current;
    if (el === null) return;
    const fits = el.scrollWidth <= el.clientWidth + 1;
    setEdges({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      fits,
    });
  }, []);

  useEffect(() => {
    const el = list.current;
    if (el === null) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      resize.disconnect();
    };
  }, [measure]);

  // A jump, not a glide: motion is for viewer transitions only (CLAUDE.md section 7).
  const page = (direction: 1 | -1) => {
    const el = list.current;
    if (el === null) return;
    if (direction === -1 ? edges.start : edges.end) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "auto" });
  };

  const grid =
    phoneOnly === undefined
      ? ""
      : `md:mx-0 md:grid md:snap-none md:overflow-visible md:px-0 md:pb-0 ${GRID[phoneOnly.columns]}`;
  const button =
    "flex items-center rounded-pill bg-surface px-3 py-1 text-ui text-primary shadow-soft transition-colors duration-hover hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent aria-disabled:cursor-default aria-disabled:text-muted aria-disabled:shadow-none aria-disabled:hover:text-muted";

  return (
    <div className="flex flex-col gap-2">
      {phoneOnly === undefined ? (
        <div
          className={`hidden justify-end gap-2 md:flex ${edges.fits ? "md:hidden" : ""}`}
        >
          <button
            type="button"
            className={button}
            onClick={() => page(-1)}
            aria-disabled={edges.start}
            aria-label={`${label}: scroll back`}
          >
            Back
          </button>
          <button
            type="button"
            className={button}
            onClick={() => page(1)}
            aria-disabled={edges.end}
            aria-label={`${label}: scroll on`}
          >
            More
          </button>
        </div>
      ) : null}
      {/* The row bleeds to the screen's edges on a phone, so the peek reaches the edge. */}
      <ul
        ref={list}
        aria-label={label}
        className={`-mx-4 m-0 flex list-none snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 [scrollbar-width:thin] ${grid}`}
      >
        {Children.toArray(children).map((child, i) => (
          <li
            key={i}
            className={`relative flex shrink-0 snap-start ${ITEM[size]} ${phoneOnly === undefined ? "" : "md:basis-auto"}`}
          >
            <div className="w-full">{child}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
