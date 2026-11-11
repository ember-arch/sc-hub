"use client";

import {
  Children,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "./icon";

/**
 * How many cards a row shows across, by width: one and the next card's edge on a phone, two on
 * a tablet, three on a desktop. The widths leave room for the gaps between them (`gap-4`, the
 * spacing scale's 16), so the cards a row shows are whole.
 */
const ITEM =
  "basis-4/5 sm:basis-[calc((100%-var(--spacing-4))/2)] lg:basis-[calc((100%-2*var(--spacing-4))/3)]";

export interface RailProps {
  /** Names the row for assistive technology, for example "Latest videos". */
  readonly label: string;
  /** Each child is one card. */
  readonly children: ReactNode;
}

interface Edges {
  readonly start: boolean;
  readonly end: boolean;
  readonly fits: boolean;
  /** The arrows' height from the row's top: the middle of the first card's picture, or null. */
  readonly middle: number | null;
}

const same = (a: Edges, b: Edges): boolean =>
  a.start === b.start &&
  a.end === b.end &&
  a.fits === b.fits &&
  a.middle === b.middle;

/**
 * A row of cards that scrolls sideways, a carousel (ADR-050): the front page's dispatches, videos
 * and developer posts, so a phone reader moves along a section with a swipe and down the page
 * past it, instead of down a column of tall cards. Scroll snapping lands each card at the edge.
 * There is no scroll bar; two round arrows sit over the row's ends (the owner asked for "overlaid
 * nav arrows, not a scroll bar", 2026-11-11), level with the middle of the cards' pictures so they
 * cover an image rather than a title, or the row's middle when the cards have none. Each moves
 * the row by one card, a jump rather than a glide (CLAUDE.md section 7 keeps motion for viewer
 * transitions). At its end of the row an arrow is hidden at once and lets presses through to the
 * card beneath, though a keyboard reader who has it focused still sees it; both are hidden when
 * the row fits. The arrows are glyphs alone, named for assistive tech ("Latest videos: next"):
 * ADR-044's one exception. Keyboard readers can also move through the cards' own links, which
 * scroll the row as they take focus. The row is a list named for its section, not a landmark.
 */
export function Rail({ label, children }: RailProps) {
  const list = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState<Edges>({
    start: true,
    end: false,
    fits: false,
    middle: null,
  });

  const measure = useCallback(() => {
    const el = list.current;
    if (el === null) return;
    const picture = el.querySelector("li img");
    const box = picture?.getBoundingClientRect();
    const next: Edges = {
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      fits: el.scrollWidth <= el.clientWidth + 1,
      middle:
        box === undefined
          ? null
          : Math.round(
              box.top - el.getBoundingClientRect().top + box.height / 2,
            ),
    };
    // Only a change re-renders the row, not every scroll event.
    setEdges((prev) => (same(prev, next) ? prev : next));
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

  /** One card's width and the gap after it, as the page draws them: one press's distance. */
  const step = (el: HTMLUListElement): number => {
    const card = el.querySelector("li");
    if (card === null) return el.clientWidth;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };

  const move = (direction: 1 | -1) => {
    const el = list.current;
    if (el === null) return;
    if (direction === -1 ? edges.start : edges.end) return;
    el.scrollBy({ left: direction * step(el), behavior: "auto" });
  };

  const arrow =
    "absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-pill bg-surface text-primary shadow-popover transition-colors duration-hover hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent aria-disabled:pointer-events-none aria-disabled:opacity-0 aria-disabled:focus-visible:opacity-100";
  const top = edges.middle === null ? undefined : { top: `${edges.middle}px` };

  return (
    <div className="relative">
      {/* The row bleeds to the screen's edges on a phone, so the next card's edge reaches it. */}
      <ul
        ref={list}
        aria-label={label}
        className="-mx-4 m-0 flex list-none snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto overscroll-x-contain px-4 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {Children.toArray(children).map((child, i) => (
          <li key={i} className={`relative flex shrink-0 snap-start ${ITEM}`}>
            <div className="w-full">{child}</div>
          </li>
        ))}
      </ul>
      {edges.fits ? null : (
        <>
          <button
            type="button"
            className={`${arrow} left-0 md:-left-4`}
            style={top}
            onClick={() => move(-1)}
            aria-disabled={edges.start}
            aria-label={`${label}: previous`}
          >
            <Icon name="next" className="rotate-180" />
          </button>
          <button
            type="button"
            className={`${arrow} right-0 md:-right-4`}
            style={top}
            onClick={() => move(1)}
            aria-disabled={edges.end}
            aria-label={`${label}: next`}
          >
            <Icon name="next" />
          </button>
        </>
      )}
    </div>
  );
}
