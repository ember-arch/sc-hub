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
