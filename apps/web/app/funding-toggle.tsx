"use client";

import { type ReactNode, useId, useState } from "react";

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

/**
 * The funding card's two controls in one row (ADR-040, amended 2026-11-11): what is counted
 * (pledges or citizens) and how it is drawn (year to date or by month). Every pairing is in the
 * document and the others are hidden, so the page stays static and a reader without script sees
 * the first measure's first view. Switching the measure keeps the view.
 */
export function FundingToggle({
  measures,
  views,
}: {
  readonly measures: readonly FundingMeasure[];
  readonly views: readonly { readonly id: string; readonly label: string }[];
}) {
  const [measure, setMeasure] = useState(0);
  const [view, setView] = useState(0);
  const base = useId();
  const current = measures[measure];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {measures.length > 1 ? (
          <div role="group" aria-label="Funding measure" className={group}>
            {measures.map((m, i) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={i === measure}
                aria-controls={`${base}-${m.id}`}
                onClick={() => setMeasure(i)}
                className={`${button} ${i === measure ? "bg-inset text-primary" : "text-secondary hover:text-primary"}`}
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
