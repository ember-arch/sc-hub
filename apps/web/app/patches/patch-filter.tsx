"use client";

import { type ChangeEvent, useId, useRef, useState } from "react";

/**
 * Narrows a patch page to the entries whose name holds the words typed (ADR-049). The page is
 * whole without it: every entry is in the HTML, so the browser's own find works too. Typing
 * hides the entries that do not match and opens the "show the rest" folds that hold matches;
 * clearing the field puts the page back as it was.
 */
export function PatchFilter() {
  const id = useId();
  const statusId = useId();
  const [count, setCount] = useState<number | null>(null);
  const opened = useRef(new Set<HTMLDetailsElement>());

  const apply = (raw: string): void => {
    const words = raw
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w !== "");
    const entries =
      document.querySelectorAll<HTMLElement>("[data-patch-entry]");
    let shown = 0;
    for (const el of entries) {
      const name = el.dataset["name"] ?? "";
      const match = words.every((w) => name.includes(w));
      el.hidden = words.length > 0 && !match;
      if (words.length > 0 && match) {
        shown += 1;
        // Open the folds a match sits in, and remember them to close again on clear.
        for (
          let fold = el.parentElement?.closest("details");
          fold !== null && fold !== undefined;
          fold = fold.parentElement?.closest("details")
        ) {
          if (!fold.open) {
            fold.open = true;
            opened.current.add(fold);
          }
        }
      }
    }
    // Blocks with nothing left to show say so instead of standing empty.
    for (const block of document.querySelectorAll<HTMLElement>(
      "[data-patch-block]",
    )) {
      const any = block.querySelector("[data-patch-entry]:not([hidden])");
      block.hidden = words.length > 0 && any === null;
    }
    if (words.length === 0) {
      for (const fold of opened.current) fold.open = false;
      opened.current.clear();
      setCount(null);
    } else {
      setCount(shown);
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    apply(event.currentTarget.value);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-caption text-secondary">
        Find a ship, part or blueprint in this patch
      </label>
      <input
        id={id}
        type="search"
        onChange={onChange}
        aria-describedby={statusId}
        autoComplete="off"
        spellCheck={false}
        placeholder="Gladius, Attrition, quantum drive"
        className="w-full rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:max-w-prose"
      />
      <p
        id={statusId}
        role="status"
        className="m-0 min-h-4 text-caption text-secondary"
      >
        {count === null
          ? ""
          : count === 0
            ? "Nothing in this patch matches"
            : `${count} ${count === 1 ? "entry matches" : "entries match"}`}
      </p>
    </div>
  );
}
