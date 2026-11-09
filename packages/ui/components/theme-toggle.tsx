"use client";

import { useSyncExternalStore } from "react";

/**
 * The theme switch (ADR-021): light or dark, the reader's choice kept in localStorage under
 * `theme` and applied as `data-theme` on `<html>`, where the token CSS reads it. Until the reader
 * chooses, the site follows the system; `apps/web/app/layout.tsx` applies a stored choice before
 * the first paint so the page never flashes the other scheme. A switch, not a menu: two states,
 * the knob on the right when dark.
 */

export const THEME_KEY = "theme";
const CHANGE_EVENT = "sc-hub:theme";

type Scheme = "light" | "dark";

function current(): Scheme {
  const set = document.documentElement.dataset["theme"];
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The server renders the switch off; the client corrects it on hydration. */
const serverScheme = (): Scheme => "light";

export function ThemeToggle() {
  const scheme = useSyncExternalStore(subscribe, current, serverScheme);
  const dark = scheme === "dark";
  const toggle = (): void => {
    const next: Scheme = dark ? "light" : "dark";
    document.documentElement.dataset["theme"] = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Private windows may refuse storage; the choice then lasts for the page.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Dark mode on" : "Dark mode off"}
      onClick={toggle}
      className="relative h-6 w-12 shrink-0 rounded-pill bg-inset transition-colors duration-hover hover:bg-accent-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-4 w-4 rounded-pill bg-primary transition-transform duration-hover ${dark ? "translate-x-7" : "translate-x-1"}`}
      />
    </button>
  );
}
