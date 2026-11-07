"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * ⌘K on desktop, the always-visible header button on phone; results grouped by entity type; keyboard
 * navigable; closes on escape; shows recent entities (system.md section 3). Phase 0 searches a
 * client-side index of fixture entities; Meilisearch replaces the matcher in spec 02.
 */

export type SearchEntryType = "ship" | "component" | "manufacturer";

export interface SearchEntry {
  readonly type: SearchEntryType;
  readonly name: string;
  readonly href: string;
  /** Secondary text, searched too: manufacturer, role, item type. */
  readonly meta?: string | undefined;
}

export interface CommandPaletteProps {
  readonly entries: readonly SearchEntry[];
  /** Stories only: render open. */
  readonly initialOpen?: boolean | undefined;
  readonly initialQuery?: string | undefined;
}

const GROUPS: readonly { type: SearchEntryType; title: string }[] = [
  { type: "ship", title: "Ships" },
  { type: "component", title: "Components" },
  { type: "manufacturer", title: "Manufacturers" },
];
const PER_GROUP = 6;
const RECENT_KEY = "sc-hub.recent";
const RECENT_MAX = 6;

/** Any element can open the palette by dispatching this on `window` (the home page's search field). */
export const OPEN_SEARCH_EVENT = "sc-hub:open-search";

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

function writeRecent(hrefs: string[]): void {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(hrefs));
  } catch {
    // Storage may be unavailable (private mode, blocked site data); recents are a convenience.
  }
}

export function matchEntries(
  entries: readonly SearchEntry[],
  query: string,
): readonly SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const scored = entries
    .map((entry) => {
      const name = entry.name.toLowerCase();
      const meta = (entry.meta ?? "").toLowerCase();
      const score = name.startsWith(q)
        ? 0
        : name.includes(q)
          ? 1
          : meta.includes(q)
            ? 2
            : -1;
      return { entry, score };
    })
    .filter((s) => s.score >= 0)
    .sort(
      (a, b) =>
        a.score - b.score || a.entry.name.localeCompare(b.entry.name, "en"),
    );
  const out: SearchEntry[] = [];
  for (const group of GROUPS) {
    out.push(
      ...scored
        .filter((s) => s.entry.type === group.type)
        .slice(0, PER_GROUP)
        .map((s) => s.entry),
    );
  }
  return out;
}

export function CommandPalette({
  entries,
  initialOpen,
  initialQuery,
}: CommandPaletteProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen === true);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => {
    if (query.trim() !== "") return matchEntries(entries, query);
    return recent
      .map((href) => entries.find((e) => e.href === href))
      .filter((e): e is SearchEntry => e !== undefined);
  }, [entries, query, recent]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const choose = useCallback(
    (entry: SearchEntry) => {
      const next = [
        entry.href,
        ...recent.filter((h) => h !== entry.href),
      ].slice(0, RECENT_MAX);
      setRecent(next);
      writeRecent(next);
      close();
      router.push(entry.href);
    },
    [close, recent, router],
  );

  // Recents are read when the palette opens, not in an effect: the server render has no storage,
  // and reading on open keeps the first client render identical to it.
  const openPalette = useCallback(() => {
    setRecent(readRecent());
    setOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) close();
        else openPalette();
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        close();
      }
    };
    const onOpen = (): void => openPalette();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpen);
    };
  }, [open, close, openPalette]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const onInputKey = (event: ReactKeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length === 0 ? 0 : (i + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) =>
        results.length === 0 ? 0 : (i - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter") {
      const entry = results[active];
      if (entry !== undefined) {
        event.preventDefault();
        choose(entry);
      }
    }
  };

  const trigger = (
    <button
      type="button"
      onClick={openPalette}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="inline-flex items-center gap-2 rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-secondary transition-colors duration-hover hover:border-hairline-strong hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span>Search</span>
      <kbd className="hidden rounded-control border border-hairline bg-inset px-1 font-mono text-caption text-secondary md:inline">
        ⌘K
      </kbd>
    </button>
  );

  return (
    <>
      {trigger}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-page/80 p-4 pt-24"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="flex w-full max-w-prose flex-col overflow-hidden rounded-palette border border-hairline bg-raised shadow-popover"
          >
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
              placeholder="Search ships, components, manufacturers"
              aria-label="Search"
              aria-controls={listId}
              aria-activedescendant={
                results[active] === undefined
                  ? undefined
                  : `${listId}-${active}`
              }
              role="combobox"
              aria-expanded="true"
              aria-autocomplete="list"
              autoComplete="off"
              className="w-full border-b border-hairline bg-raised px-4 py-3 text-body text-primary outline-none placeholder:text-muted"
            />
            <ul
              id={listId}
              role="listbox"
              className="m-0 max-h-[60dvh] list-none overflow-y-auto p-2"
            >
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-ui text-secondary">
                  {query.trim() === ""
                    ? "Type to search. Recent entities appear here."
                    : `No results for "${query.trim()}". Try a ship, component or manufacturer name.`}
                </li>
              ) : (
                GROUPS.map((group) => {
                  const items = results
                    .map((entry, index) => ({ entry, index }))
                    .filter(({ entry }) => entry.type === group.type);
                  if (items.length === 0) return null;
                  return (
                    <li key={group.type} role="presentation">
                      <p className="px-3 pb-1 pt-2 text-caption text-secondary">
                        {query.trim() === ""
                          ? `Recent ${group.title.toLowerCase()}`
                          : group.title}
                      </p>
                      <ul
                        role="group"
                        aria-label={group.title}
                        className="m-0 list-none p-0"
                      >
                        {items.map(({ entry, index }) => (
                          <li
                            key={entry.href}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseEnter={() => setActive(index)}
                            onMouseDown={(event) => {
                              event.preventDefault();
                              choose(entry);
                            }}
                            className={`flex cursor-pointer items-baseline justify-between gap-4 rounded-control px-3 py-2 text-ui ${index === active ? "bg-accent-bg text-primary" : "text-primary"}`}
                          >
                            <span>{entry.name}</span>
                            {entry.meta !== undefined ? (
                              <span className="truncate text-caption text-secondary">
                                {entry.meta}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
