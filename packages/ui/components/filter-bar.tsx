"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";
import { TextLink } from "./text-link";

/**
 * Filters as URL state (spec 02, "Ship index"): a GET form whose fields are the query string, so
 * every filtered view has a shareable address and works without JavaScript. With JavaScript the
 * form submits itself and navigates client-side to the URL a plain GET would reach, minus the
 * empty fields; without it the Apply button inside `<noscript>` does.
 *
 * When to submit (WCAG 3.2.2, "on input"): a pointer pick submits at once. Arrow keys on a
 * focused select change its value without submitting, so a keyboard user can step through the
 * options; Enter or leaving the control submits the change. Navigation keeps scroll and focus
 * where they are.
 */

export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

export interface FilterSelectProps {
  readonly name: string;
  readonly label: string;
  /** The current value from the URL; "" means no filter. */
  readonly value: string;
  readonly options: readonly FilterOption[];
  /** The first option, meaning no filter, for example "All manufacturers". */
  readonly allLabel: string;
}

export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel,
}: FilterSelectProps) {
  const id = useId();
  // Local state so the control shows what the reader picked before the navigation lands; it
  // follows the URL value whenever that changes.
  const [current, setCurrent] = useState(value);
  const [fromUrl, setFromUrl] = useState(value);
  if (fromUrl !== value) {
    setFromUrl(value);
    setCurrent(value);
  }
  const viaKeyboard = useRef(false);

  const submit = (form: HTMLFormElement | null): void => {
    form?.requestSubmit();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLSelectElement>): void => {
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === "PageUp" ||
      event.key === "PageDown"
    ) {
      viaKeyboard.current = true;
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (event.currentTarget.value !== value) submit(event.currentTarget.form);
    }
  };
  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    setCurrent(event.currentTarget.value);
    if (viaKeyboard.current) {
      viaKeyboard.current = false;
      return;
    }
    submit(event.currentTarget.form);
  };
  const onBlur = (event: FocusEvent<HTMLSelectElement>): void => {
    viaKeyboard.current = false;
    if (event.currentTarget.value !== value) submit(event.currentTarget.form);
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-caption text-secondary">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={current}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="w-full rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface FilterBarProps {
  /** The route the form submits to, for example "/ships". */
  readonly action: string;
  readonly label: string;
  /** Query parameters to keep across submits that are not filters, for example the view. Rendered after the filters so the URL order matches the page's own links. */
  readonly hidden?: Readonly<Record<string, string>> | undefined;
  /** Where "Clear filters" goes when any filter is active; omitted when none is. */
  readonly clearHref?: string | undefined;
  readonly children: ReactNode;
}

/** The URL a GET submit would reach, without the fields left at "no filter". */
export function filterHref(action: string, data: FormData): string {
  const params = new URLSearchParams();
  for (const [name, value] of data) {
    if (typeof value === "string" && value !== "") params.append(name, value);
  }
  const query = params.toString();
  return query === "" ? action : `${action}?${query}`;
}

export function FilterBar({
  action,
  label,
  hidden,
  clearHref,
  children,
}: FilterBarProps) {
  const router = useRouter();
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    router.push(filterHref(action, new FormData(event.currentTarget)), {
      scroll: false,
    });
  };
  return (
    <form
      method="get"
      action={action}
      aria-label={label}
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
        {children}
        <noscript>
          <button
            type="submit"
            className="rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary hover:border-hairline-strong"
          >
            Apply
          </button>
        </noscript>
      </div>
      {hidden === undefined
        ? null
        : Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
      {clearHref !== undefined ? (
        <p className="m-0 text-caption">
          <TextLink href={clearHref}>Clear filters</TextLink>
        </p>
      ) : null}
    </form>
  );
}
