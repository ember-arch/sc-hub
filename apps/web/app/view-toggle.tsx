"use client";

import { type ReactNode, useId, useState } from "react";

export interface View {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
}

/**
 * Two or more server-rendered views, one shown at a time (ADR-038): the buttons read as one
 * control in the segmented control's own classes, the pressed one marked with `aria-pressed`; the
 * first view shows until a reader presses another, so a page stays static and a reader without
 * script still sees the first. Every view is in the document; the others are hidden.
 */
export function ViewToggle({
  label,
  views,
}: {
  readonly label: string;
  readonly views: readonly View[];
}) {
  const [current, setCurrent] = useState(0);
  const base = useId();
  return (
    <div className="flex flex-col gap-4">
      <div
        role="group"
        aria-label={label}
        className="inline-flex self-start rounded-control border border-hairline bg-surface p-1 text-ui"
      >
        {views.map((view, i) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={i === current}
            aria-controls={`${base}-${view.id}`}
            onClick={() => setCurrent(i)}
            className={`rounded-control px-3 py-1 transition-colors duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${i === current ? "bg-inset text-primary" : "text-secondary hover:text-primary"}`}
          >
            {view.label}
          </button>
        ))}
      </div>
      {views.map((view, i) => (
        <div key={view.id} id={`${base}-${view.id}`} hidden={i !== current}>
          {view.content}
        </div>
      ))}
    </div>
  );
}
