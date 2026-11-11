/**
 * Which builds a patches run fetches, and when a new build looks half-imported (ADR-049). Pure,
 * so the rules are unit-tested without a run (`scripts/__tests__/patches.plan.test.ts`).
 */

/** The build number at the end of a build string, which only grows from build to build. */
export const buildNumber = (code: string): number =>
  Number(/\.(\d+)$/.exec(code)?.[1] ?? 0);

/**
 * The builds to fetch, oldest first: a build's address depends on which builds of its version came
 * before it (the first keeps the plain version), so a build never lands before an older one the
 * API lists, and no address moves when the older one lands later (CLAUDE.md section 5).
 */
export function planBuilds<T extends { readonly code: string }>(
  listed: readonly T[],
  filed: ReadonlySet<string>,
  options: { readonly only?: readonly string[]; readonly max?: number } = {},
): T[] {
  const only = options.only ?? [];
  return listed
    .filter(
      (v) => !filed.has(v.code) && (only.length === 0 || only.includes(v.code)),
    )
    .sort((a, b) => buildNumber(a.code) - buildNumber(b.code))
    .slice(0, options.max ?? Infinity);
}

export interface ListedCounts {
  readonly code: string;
  /** Ships with figures plus the vehicles the build lists without them: everything listed. */
  readonly vehicles: number;
  readonly parts: number;
}

/**
 * Whether a build newer than every build on file holds under nine tenths of the newest file's
 * vehicles or parts: the wiki is still importing it, and a file written now would freeze the gap.
 * Vehicles count those listed without figures too, so a ship that only left the ship matrix in
 * the build's records (4.8.0 to 4.8.1: 279 ships became 236, but 288 vehicles stayed 288) is not
 * taken for a gap.
 */
export function looksIncomplete(
  build: ListedCounts,
  newest: ListedCounts | null,
): boolean {
  if (newest === null) return false;
  if (buildNumber(build.code) <= buildNumber(newest.code)) return false;
  return (
    build.vehicles < newest.vehicles * 0.9 || build.parts < newest.parts * 0.9
  );
}
