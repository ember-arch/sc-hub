"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * The search field inside the titles filter form. It is a plain GET field (`q`), so a search is a
 * shareable address and works without JavaScript (Enter submits). With JavaScript it also submits
 * itself a moment after typing stops; the form navigates without a reload and keeps focus here.
 */
export function TitleSearch({ value }: { readonly value: string }) {
  const id = useId();
  // Local state so typing is never interrupted; it follows the URL when that changes (clear filters).
  const [current, setCurrent] = useState(value);
  const [fromUrl, setFromUrl] = useState(value);
  if (fromUrl !== value) {
    setFromUrl(value);
    setCurrent(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setCurrent(event.currentTarget.value);
    const form = event.currentTarget.form;
    cancel();
    timer.current = setTimeout(() => form?.requestSubmit(), 350);
  };
  // Enter submits at once through the form; drop the pending one so it does not submit twice.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") cancel();
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
        autoComplete="off"
        spellCheck={false}
        placeholder="Name, event or how it is earned"
        className="w-full rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  );
}
