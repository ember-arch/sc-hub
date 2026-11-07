"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SITE_NAME } from "ui/brand";
import { MAX_COMPARE, toggleShip } from "./compare";

/**
 * The compare basket: the ship slugs a reader has picked from ship pages and the index, kept in
 * local storage (wrapped in try/catch, like the palette's recents) so they survive navigation
 * without a server session. The compare page's URL is the source of truth for what is shown; the
 * basket feeds it and is set from it when a compare URL is opened.
 */

const KEY = `${SITE_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.compare`;
const CHANGE_EVENT = "compare-change";
const EMPTY: readonly string[] = Object.freeze([]);

let snapshot: readonly string[] = EMPTY;
let loaded = false;

function read(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    const slugs = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
    return Object.freeze(slugs.slice(0, MAX_COMPARE));
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): readonly string[] {
  if (!loaded) {
    snapshot = read();
    loaded = true;
  }
  return snapshot;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

export function writeCompare(slugs: readonly string[]): void {
  snapshot = Object.freeze([...slugs].slice(0, MAX_COMPARE));
  loaded = true;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Storage may be unavailable; the in-memory basket still works for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === KEY) {
      snapshot = read();
      onChange();
    }
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCompareBasket(): {
  readonly slugs: readonly string[];
  readonly toggle: (slug: string) => void;
  readonly set: (slugs: readonly string[]) => void;
} {
  const slugs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = useCallback(
    (slug: string) => writeCompare(toggleShip(getSnapshot(), slug)),
    [],
  );
  return { slugs, toggle, set: writeCompare };
}
