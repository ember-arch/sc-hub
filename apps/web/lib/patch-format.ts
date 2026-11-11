import type { PatchIngredient, PatchValue } from "schema";
import type { FigureChange } from "./patches";

/**
 * How the patch pages write a figure and its change (ADR-049). Figures are shown as the source
 * states them, to as many digits as it gives (up to seven significant), never rounded to look
 * tidy: a drive's fuel use of 0.036064 stays 0.036064.
 */

const figures = new Intl.NumberFormat("en-GB", {
  maximumSignificantDigits: 7,
});

export function formatValue(v: PatchValue | null): string {
  if (v === null) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return figures.format(v);
  return v;
}

export function formatIngredient(i: PatchIngredient | null): string {
  if (i === null) return "—";
  return i.unit === "SCU"
    ? `${figures.format(i.amount)} SCU`
    : `${figures.format(i.amount)}`;
}

export interface ChangeText {
  /** "↑ 6" or "↓ 0.2", or a word when the change is not a number. */
  readonly text: string;
  /** "+2.7%" beside it, when both sides are numbers and the old one is not zero. */
  readonly percent: string | null;
  /** For screen readers: "up 6", "down 0.2", "new", "no longer stated", "changed". */
  readonly spoken: string;
  readonly direction: "up" | "down" | null;
}

const percent = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 1,
  signDisplay: "always",
});

/** Fixes binary noise in the difference of two decimals: 0.30000000000000004 → 0.3. */
function tidy(n: number): number {
  return Number.parseFloat(n.toPrecision(12));
}

export function changeOf(
  from: PatchValue | null,
  to: PatchValue | null,
): ChangeText {
  if (from === null)
    return {
      text: "New",
      percent: null,
      spoken: "new figure",
      direction: null,
    };
  if (to === null)
    return {
      text: "Gone",
      percent: null,
      spoken: "no longer stated",
      direction: null,
    };
  if (typeof from === "number" && typeof to === "number") {
    const delta = tidy(to - from);
    const dir = delta > 0 ? "up" : "down";
    return {
      text: `${delta > 0 ? "↑" : "↓"} ${figures.format(Math.abs(delta))}`,
      percent:
        from === 0
          ? null
          : `${percent.format((delta / Math.abs(from)) * 100)}%`,
      spoken: `${dir} ${figures.format(Math.abs(delta))}`,
      direction: dir,
    };
  }
  return { text: "Changed", percent: null, spoken: "changed", direction: null };
}

/** The share a number moved by, for ordering an entry's headline changes; text changes rank last. */
export function weight(f: FigureChange): number {
  if (typeof f.from === "number" && typeof f.to === "number") {
    if (f.from === 0) return f.to === 0 ? 0 : 1;
    return Math.abs((f.to - f.from) / f.from);
  }
  return 0.0001;
}

/** The changes an entry's summary line shows: the ones that moved most, at most `n`. */
export function topChanges(
  list: readonly FigureChange[],
  n: number,
): FigureChange[] {
  return [...list].sort((a, b) => weight(b) - weight(a)).slice(0, n);
}
