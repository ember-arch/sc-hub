"use client";

import { OPEN_SEARCH_EVENT } from "./command-palette";

/**
 * The home page's first element (system.md section 4): looks like a search field, opens the
 * command palette. Search is the navigation (principle 4), so there is one search, not two.
 */
export function SearchField() {
  const open = (): void => {
    window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
  };
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className="flex w-full items-center justify-between rounded-card border border-hairline bg-surface px-4 py-3 text-left text-ui text-secondary transition-colors duration-hover hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span>Search ships, components, manufacturers and titles</span>
      <kbd className="hidden rounded-control border border-hairline bg-inset px-1 font-mono text-caption md:inline">
        ⌘K
      </kbd>
    </button>
  );
}
