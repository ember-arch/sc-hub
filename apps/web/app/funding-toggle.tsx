"use client";

import { type ReactNode, useEffect, useId, useState } from "react";

/** One measure of the card: its figures and its drawing in each view, all server-rendered. */
export interface FundingMeasure {
  readonly id: string;
  readonly label: string;
  readonly figures: ReactNode;
  /** By view id, in the order of `views`. */
  readonly content: Readonly<Record<string, ReactNode>>;
}

const group =
  "inline-flex self-start rounded-control border border-hairline bg-surface p-1 text-ui";
const button =
  "rounded-control px-3 py-1 transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";
// A measure's address lands on its button with the card's running head still in view, about
// where the head's own address lands.
const target = "scroll-mt-12";

/**
 * The funding card's two controls in one row (ADR-040, amended 2026-11-11): what is counted
 * (pledges or citizens) and how it is drawn (year to date or by month). Every pairing is in the
 * document and the others are hidden, so the page stays static and a reader without script sees
 * the first measure's first view. Switching the measure keeps the view.
 *
 * Each measure has an address, `#<anchor>-<measure>` (`#funding-citizens`), on its button: the
 * front page's counters link to their own measure's, so the Citizens figure opens the card on
 * citizens (amended 2026-11-12). The address is read on load and on every change, and a press on
 * a link to one opens its measure. Pressing a measure while the address names one rewrites it in
 * place, so it never names the measure that isn't shown. A bare `#<anchor>` leaves the measure as
 * it is.
 */
export function FundingToggle({
  anchor,
  measures,
  views,
}: {
  /** The card's running head's id; the measures' addresses start with it. */
  readonly anchor: string;
  readonly measures: readonly FundingMeasure[];
  readonly views: readonly { readonly id: string; readonly label: string }[];
}) {
  const [measure, setMeasure] = useState(0);
  const [view, setView] = useState(0);
  const base = useId();
  const current = measures[measure];
  // The measures' ids as one string, so the effect below runs once, not on every render.
  const ids = measures.map((m) => m.id).join(" ");

  useEffect(() => {
    const order = ids.split(" ");
    const open = (hash: string) => {
      const i = order.findIndex((id) => hash === `#${anchor}-${id}`);
      if (i >= 0) setMeasure(i);
    };
    // A press on a link to a measure's address on this page. Next's links (the figure strip's)
    // move the address with pushState, which the browser does not announce, so the press is
    // what tells; it also works when the address already names that measure.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (event.shiftKey || event.altKey) return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target !== "" && link.target !== "_self") return;
      const url = new URL(link.href);
      const here = window.location;
      if (url.origin === here.origin && url.pathname === here.pathname) {
        open(url.hash);
      }
    };
    // The address itself: on load, typed in, or a plain anchor.
    const onHash = () => open(window.location.hash);
    onHash();
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, [anchor, ids]);

  const choose = (i: number) => {
    setMeasure(i);
    const m = measures[i];
    const named = measures.some(
      (n) => window.location.hash === `#${anchor}-${n.id}`,
    );
    if (m !== undefined && named) {
      // In place: the press neither scrolls nor adds a step to the history. A null state is
      // Next's documented form, so its router keeps the new address too.
      window.history.replaceState(null, "", `#${anchor}-${m.id}`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        // With one measure there are no measure buttons; its address lands on the row instead.
        id={
          measures.length === 1 && current !== undefined
            ? `${anchor}-${current.id}`
            : undefined
        }
        className={`flex flex-wrap items-center gap-3 ${target}`}
      >
        {measures.length > 1 ? (
          <div role="group" aria-label="Funding measure" className={group}>
            {measures.map((m, i) => (
              <button
                key={m.id}
                id={`${anchor}-${m.id}`}
                type="button"
                aria-pressed={i === measure}
                aria-controls={`${base}-${m.id}`}
                onClick={() => choose(i)}
                className={`${button} ${target} ${i === measure ? "bg-inset text-primary" : "text-secondary hover:text-primary"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        ) : null}
        <div role="group" aria-label="Funding view" className={group}>
          {views.map((v, i) => (
            <button
              key={v.id}
              type="button"
              aria-pressed={i === view}
              aria-controls={
                current === undefined
                  ? undefined
                  : `${base}-${current.id}-${v.id}`
              }
              onClick={() => setView(i)}
              className={`${button} ${i === view ? "bg-inset text-primary" : "text-secondary hover:text-primary"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      {measures.map((m, i) => (
        <div
          key={m.id}
          id={`${base}-${m.id}`}
          data-measure={m.id}
          hidden={i !== measure}
          className="flex flex-col gap-4"
        >
          {m.figures}
          {views.map((v, j) => (
            <div key={v.id} id={`${base}-${m.id}-${v.id}`} hidden={j !== view}>
              {m.content[v.id]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
