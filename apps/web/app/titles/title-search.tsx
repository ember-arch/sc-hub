"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { filterHref } from "ui";

/** The server keeps at most this many characters of `q` (lib/titles.ts). */
export const MAX_QUERY = 100;

/**
 * The search field inside the titles filter form. It is a plain GET field (`q`), so a search is a
 * shareable address and works without JavaScript (Enter submits). With JavaScript it also updates
 * the address a moment after typing stops, replacing the history entry rather than adding one per
 * pause; the page re-renders without a reload and focus stays here.
 */
export function TitleSearch({ value }: { readonly value: string }) {
  const id = useId();
  const router = useRouter();
  const [current, setCurrent] = useState(value);
  const [fromUrl, setFromUrl] = useState(value);
  // What this field has sent, as the server will read it. When the address catches up with any of
  // them, the field keeps what is typed now (letters typed while the page loaded, a trailing space
  // the server trims, a slow answer to an older search); only a change from elsewhere (Clear
  // filters, the back button) replaces it.
  const [sent, setSent] = useState<readonly string[]>([]);
  if (fromUrl !== value) {
    setFromUrl(value);
    if (!sent.includes(value)) {
      setCurrent(value);
      setSent([]);
    }
  }
  const remember = (text: string): void => {
    setSent((prior) => [...prior, text.trim().slice(0, MAX_QUERY)]);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const text = event.currentTarget.value;
    const form = event.currentTarget.form;
    setCurrent(text);
    cancel();
    timer.current = setTimeout(() => {
      if (form === null) return;
      remember(text);
      const action = form.getAttribute("action") ?? "/titles";
      router.replace(filterHref(action, new FormData(form)), { scroll: false });
    }, 350);
  };
  // Enter submits through the form at once (a history entry the reader asked for).
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    cancel();
    remember(event.currentTarget.value);
  };

  return (
    <div className="col-span-2 flex min-w-0 flex-col gap-1 md:max-w-prose md:flex-1">
      <label htmlFor={id} className="text-caption text-secondary">
        Search titles
      </label>
      <input
        id={id}
        type="search"
        name="q"
        value={current}
        onChange={onChange}
        onKeyDown={onKeyDown}
        maxLength={MAX_QUERY}
        autoComplete="off"
        spellCheck={false}
        placeholder="Name, event or how it is earned"
        className="w-full rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  );
}
