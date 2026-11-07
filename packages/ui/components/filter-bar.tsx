"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useId } from "react";
import { TextLink } from "./text-link";

/**
 * Filters as URL state (spec 02, "Ship index"): a GET form whose fields are the query string, so
 * every filtered view has a shareable address and works without JavaScript. With JavaScript the
 * form submits itself on each change and navigates client-side to the same URL the plain GET
 * would produce, minus the empty fields; without it the Apply button inside `<noscript>` does.
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
  const onChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    event.currentTarget.form?.requestSubmit();
  };
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-caption text-secondary">
        {label}
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={onChange}
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
  /** Query parameters to keep across submits that are not filters, for example the view. */
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
    router.push(filterHref(action, new FormData(event.currentTarget)));
  };
  return (
    <form
      method="get"
      action={action}
      aria-label={label}
      onSubmit={onSubmit}
      className="flex flex-col gap-3"
    >
      {hidden === undefined
        ? null
        : Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
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
      {clearHref !== undefined ? (
        <p className="m-0 text-caption">
          <TextLink href={clearHref}>Clear filters</TextLink>
        </p>
      ) : null}
    </form>
  );
}
