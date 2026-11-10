/**
 * The cargo grids (ADR-028). The game gives a ship its cargo grids: each a space of a width,
 * height and length in metres that holds a number of SCU, open to space or not, with the
 * smallest and largest standard box it takes. They are in the vehicle's record as the Wiki API
 * serves it, kept in `VehicleStats.raw` like the armour (ADR-026). The standard boxes' shapes
 * come from the cargo item records (`fixtures/cargo/CargoBox.json`). Nothing here is computed
 * beyond counting how many boxes of one shape stand in rows on a grid: boxes upright, turned a
 * quarter on the floor where that fits more, in as many layers as the height takes. The game's
 * own placement, mixed loads, doors and loading access are not modelled, and the figure says so.
 */

import type { CargoBox } from "schema";

export interface CargoGrid {
  readonly width: number;
  readonly height: number;
  readonly length: number;
  readonly scu: number;
  /** Open to space, as the record flags it. */
  readonly external: boolean;
  /** The smallest and largest box the record says the grid takes, in SCU; null where it does not say. */
  readonly minBox: number | null;
  readonly maxBox: number | null;
}

/** Identical grids drawn once with a count. */
export interface GridGroup {
  readonly grid: CargoGrid;
  readonly count: number;
}

export interface Fit {
  /** Boxes across the width, along the length, and layers up the height. */
  readonly across: number;
  readonly along: number;
  readonly layers: number;
  readonly count: number;
  /** The box's length runs across the grid's width. */
  readonly turned: boolean;
}

const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const positive = (v: unknown): number | null => {
  const n = num(v);
  return n === null || n <= 0 ? null : n;
};

/**
 * The vehicle record's cargo grids: every grid with its three dimensions and its SCU, or null
 * where the record has no grid list; a grid missing a dimension is left out, never guessed.
 */
export function cargoGridsOf(raw: unknown): CargoGrid[] | null {
  const list = obj(raw)?.["cargo_grids"];
  if (!Array.isArray(list)) return null;
  const grids: CargoGrid[] = [];
  for (const entry of list) {
    const g = obj(entry);
    if (g === null) continue;
    const width = positive(g["width"]);
    const height = positive(g["height"]);
    const length = positive(g["length"]);
    const scu = positive(g["scu"]);
    if (width === null || height === null || length === null || scu === null)
      continue;
    grids.push({
      width,
      height,
      length,
      scu,
      external: g["external"] === true,
      minBox: positive(g["min_scu_box"]),
      maxBox: positive(g["max_scu_box"]),
    });
  }
  return grids;
}

const sameGrid = (a: CargoGrid, b: CargoGrid): boolean =>
  a.width === b.width &&
  a.height === b.height &&
  a.length === b.length &&
  a.scu === b.scu &&
  a.external === b.external &&
  a.minBox === b.minBox &&
  a.maxBox === b.maxBox;

/** Identical grids together, largest first, in the record's order among equals. */
export function groupGrids(grids: readonly CargoGrid[]): GridGroup[] {
  const groups: { grid: CargoGrid; count: number }[] = [];
  for (const grid of grids) {
    const found = groups.find((g) => sameGrid(g.grid, grid));
    if (found === undefined) groups.push({ grid, count: 1 });
    else found.count += 1;
  }
  return groups.sort((a, b) => b.grid.scu - a.grid.scu);
}

/** The edge of one SCU cell on this grid, from its own volume and SCU. */
export function cellOf(grid: CargoGrid): number {
  return Math.cbrt((grid.width * grid.height * grid.length) / grid.scu);
}

/** Whether the record's smallest and largest box admit this size. */
export function gridTakes(grid: CargoGrid, box: CargoBox): boolean {
  if (grid.minBox !== null && box.scu < grid.minBox) return false;
  if (grid.maxBox !== null && box.scu > grid.maxBox) return false;
  return true;
}

// Floor division with a little slack for the binary fractions of metres.
const fits = (space: number, size: number): number =>
  Math.floor(space / size + 1e-9);

/**
 * How many boxes of one shape stand in rows on the grid: upright, in rows across the width and
 * along the length, in as many layers as the height takes, turned a quarter on the floor where
 * that holds more. Zero where the record says the grid does not take the size.
 */
export function fitOf(grid: CargoGrid, box: CargoBox): Fit {
  const none: Fit = { across: 0, along: 0, layers: 0, count: 0, turned: false };
  if (!gridTakes(grid, box)) return none;
  const layers = fits(grid.height, box.height_m);
  if (layers === 0) return none;
  const straight = {
    across: fits(grid.width, box.width_m),
    along: fits(grid.length, box.length_m),
  };
  const turned = {
    across: fits(grid.width, box.length_m),
    along: fits(grid.length, box.width_m),
  };
  const pick =
    turned.across * turned.along > straight.across * straight.along
      ? { ...turned, turned: true }
      : { ...straight, turned: false };
  const count = pick.across * pick.along * layers;
  return count === 0
    ? none
    : {
        across: pick.across,
        along: pick.along,
        layers,
        count,
        turned: pick.turned,
      };
}

/** The largest box size any of the grids takes, by the record; null without grids. */
export function largestBox(grids: readonly CargoGrid[]): number | null {
  let largest: number | null = null;
  for (const g of grids) {
    if (g.maxBox !== null && (largest === null || g.maxBox > largest))
      largest = g.maxBox;
  }
  return largest;
}

/** The boxes' SCU the grids hold at once, for one size, over every grid. */
export function scuHeld(groups: readonly GridGroup[], box: CargoBox): number {
  return groups.reduce(
    (sum, g) => sum + fitOf(g.grid, box).count * g.count * box.scu,
    0,
  );
}
