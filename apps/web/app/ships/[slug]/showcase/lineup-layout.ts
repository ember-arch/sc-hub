/**
 * The Scale lineup's row, from the recorded lengths alone (ADR-015). A model scaled to its length
 * is exactly that long along the row, so every ship has its place before any model arrives: the
 * paper, the ground line and the camera go up at once and each ship is drawn where it stands the
 * moment its own model lands. Pure arithmetic, so it is tested without WebGL.
 */

export interface RowSlot<T> {
  readonly ship: T;
  /** Where the bow starts along the row, after the row is centred on the origin. */
  readonly from: number;
  /** The slot's middle along the row. */
  readonly x: number;
  readonly length: number;
}

export interface RowLayout<T> {
  readonly slots: readonly RowSlot<T>[];
  /** Where the person stands, after centring; null without a figure. */
  readonly personAt: number | null;
  /** The row's whole length, person included. */
  readonly rowLength: number;
  /** The row is centred on the origin: `from` and `x` already carry this shift. */
  readonly shift: number;
}

/** A person's footprint along the row, before the figure's model says. */
export const PERSON_WIDTH = 0.8;

/** The gap after a ship: about a fifth of the smaller neighbour, two metres at least. */
export function rowGap(length: number, next: number | undefined): number {
  return Math.max(2, 0.22 * Math.min(length, next ?? length));
}

/** Lays the ships out largest first, each `length` metres long, then the person, centred. */
export function layoutRow<T extends { readonly length: number }>(
  ships: readonly T[],
  withPerson: boolean,
): RowLayout<T> {
  const order = [...ships].sort((a, b) => b.length - a.length);
  const raw: { ship: T; from: number }[] = [];
  let cursor = 0;
  let end = 0;
  order.forEach((ship, i) => {
    raw.push({ ship, from: cursor });
    end = cursor + ship.length;
    cursor = end + rowGap(ship.length, order[i + 1]?.length);
  });
  const rowLength = withPerson ? cursor + PERSON_WIDTH : end;
  const shift = -rowLength / 2;
  return {
    slots: raw.map(({ ship, from }) => ({
      ship,
      from: from + shift,
      x: from + shift + ship.length / 2,
      length: ship.length,
    })),
    personAt: withPerson ? cursor + shift : null,
    rowLength,
    shift,
  };
}

/** The ratios of the page ship's length the spectrum reaches for: a quarter, half, twice, four times. */
export const SPECTRUM_RATIOS: readonly number[] = [0.25, 0.5, 2, 4];

/**
 * Four ships across the range of sizes about the page's ship (owner, 2026-11-10: "a dynamic
 * spectrum of 4 ships + the one on the page"): for each ratio in turn, the ship not yet chosen
 * whose length is nearest, in proportion, to that multiple of the page ship's length. Where the
 * catalog runs out on one side (the largest ship has nothing twice its size) the nearest ships
 * that are left stand in. Fewer than four other ships: all of them. Largest first.
 */
export function spectrumAround<
  T extends { readonly slug: string; readonly length: number },
>(ships: readonly T[], current: T, ratios = SPECTRUM_RATIOS): T[] {
  const others = ships.filter((s) => s.slug !== current.slug && s.length > 0);
  const chosen: T[] = [];
  for (const ratio of ratios) {
    const target = Math.log(current.length * ratio);
    let best: T | undefined;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const ship of others) {
      if (chosen.includes(ship)) continue;
      const gap = Math.abs(Math.log(ship.length) - target);
      if (gap < bestGap) {
        best = ship;
        bestGap = gap;
      }
    }
    if (best !== undefined) chosen.push(best);
  }
  return chosen.sort((a, b) => b.length - a.length);
}
