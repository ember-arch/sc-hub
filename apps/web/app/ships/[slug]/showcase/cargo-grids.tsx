"use client";

import { useId, useState } from "react";
import type { CargoBox } from "schema";
import {
  type CargoGrid,
  type Fit,
  type GridGroup,
  cellOf,
  fitOf,
  gridTakes,
  scuHeld,
} from "../../../../lib/cargo";

/**
 * The cargo grids (ADR-028), drawn in ink on the page's paper like the holomodel (ADR-020): each
 * grid of the ship's record as a wire box in cells of one SCU, seen from a corner, and in it
 * boxes of one standard size, as many as stand in rows (`fitOf`). A picker chooses the size;
 * identical grids are drawn once with a count. Under the drawing, a table of every size against
 * every grid. Nothing is drawn that the record does not give: the game's own placement, mixed
 * loads, doors and loading access are not modelled, and the caption says so.
 */

export interface CargoGridsProps {
  readonly shipName: string;
  readonly groups: readonly GridGroup[];
  readonly boxes: readonly CargoBox[];
  /** The size shown first: the largest box the ship takes, by its record. */
  readonly defaultScu: number;
  readonly label: string;
  readonly version: string | null;
  /** The build the box shapes were read for; named in the caption when it is not the pack's. */
  readonly boxesVersion: string | null;
}

const n0 = (v: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
const n2 = (v: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
const plural = (n: number, one: string, many: string): string =>
  n === 1 ? one : many;

// Seen from a corner: x (the width) runs right and down, y (the length) right and up, z up.
const COS = Math.cos(Math.PI / 6);
const SIN = Math.sin(Math.PI / 6);
const project = (x: number, y: number, z: number): [number, number] => [
  (x + y) * COS,
  (x - y) * SIN - z,
];

interface Cuboid {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly w: number;
  readonly l: number;
  readonly h: number;
}

const path = (points: readonly [number, number][]): string =>
  `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ")}Z`;

/** The three faces of a cuboid the viewer sees: top, the near side across, the near side along. */
function faces(c: Cuboid): { top: string; across: string; along: string } {
  const p = (dx: number, dy: number, dz: number) =>
    project(c.x + dx, c.y + dy, c.z + dz);
  return {
    top: path([p(0, 0, c.h), p(c.w, 0, c.h), p(c.w, c.l, c.h), p(0, c.l, c.h)]),
    // The face at x = w, towards the viewer's lower right.
    across: path([
      p(c.w, 0, 0),
      p(c.w, c.l, 0),
      p(c.w, c.l, c.h),
      p(c.w, 0, c.h),
    ]),
    // The face at y = 0, towards the viewer's lower left.
    along: path([p(0, 0, 0), p(c.w, 0, 0), p(c.w, 0, c.h), p(0, 0, c.h)]),
  };
}

/** The boxes of a fit, back to front so nearer boxes draw over farther ones. */
function boxesOf(fit: Fit, box: CargoBox): Cuboid[] {
  const w = fit.turned ? box.length_m : box.width_m;
  const l = fit.turned ? box.width_m : box.length_m;
  const out: Cuboid[] = [];
  for (let k = 0; k < fit.layers; k += 1)
    for (let i = 0; i < fit.across; i += 1)
      for (let j = 0; j < fit.along; j += 1)
        out.push({
          x: i * w,
          y: j * l,
          z: k * box.height_m,
          w,
          l,
          h: box.height_m,
        });
  // Nearer means further along x and less along y; a box draws after what stands behind and below it.
  return out.sort((a, b) => a.x - a.y - (b.x - b.y) || a.z - b.z);
}

/** One grid as a wire box with its floor in cells, holding the boxes of the chosen size. */
function GridDrawing({
  grid,
  box,
  fit,
  scale,
  title,
}: {
  readonly grid: CargoGrid;
  readonly box: CargoBox;
  readonly fit: Fit;
  readonly scale: number;
  readonly title: string;
}) {
  const cell = cellOf(grid);
  const corners = [
    [0, 0, 0],
    [grid.width, 0, 0],
    [grid.width, grid.length, 0],
    [0, grid.length, 0],
    [0, 0, grid.height],
    [grid.width, 0, grid.height],
    [grid.width, grid.length, grid.height],
    [0, grid.length, grid.height],
  ] as const;
  const projected = corners.map(([x, y, z]) => project(x, y, z));
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const pad = 0.4;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const width = Math.max(...xs) - minX + pad;
  const height = Math.max(...ys) - minY + pad;
  const edge = (a: number, b: number) =>
    `M${projected[a]![0].toFixed(2)} ${projected[a]![1].toFixed(2)}L${projected[b]![0].toFixed(2)} ${projected[b]![1].toFixed(2)}`;
  // The floor's cell lines, then the wire box: the three hidden edges behind the boxes dashed.
  const floorLines: string[] = [];
  for (let x = cell; x < grid.width - 1e-6; x += cell) {
    const [ax, ay] = project(x, 0, 0);
    const [bx, by] = project(x, grid.length, 0);
    floorLines.push(
      `M${ax.toFixed(2)} ${ay.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}`,
    );
  }
  for (let y = cell; y < grid.length - 1e-6; y += cell) {
    const [ax, ay] = project(0, y, 0);
    const [bx, by] = project(grid.width, y, 0);
    floorLines.push(
      `M${ax.toFixed(2)} ${ay.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}`,
    );
  }
  const stroke = 0.9 / scale;
  const cuboids = fit.count === 0 ? [] : boxesOf(fit, box);
  return (
    <svg
      viewBox={`${minX.toFixed(2)} ${minY.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`}
      width={Math.round(width * scale)}
      height={Math.round(height * scale)}
      role="img"
      aria-label={title}
      className="max-w-full"
      style={{ height: "auto" }}
    >
      <g
        className="text-secondary"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke * 0.6}
        strokeLinecap="round"
      >
        {floorLines.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g
        className="text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
      >
        {/* The far corner's edges, behind the boxes: dashed. */}
        <g
          strokeDasharray={`${3 * stroke} ${3 * stroke}`}
          className="text-secondary"
        >
          <path d={edge(3, 7)} />
          <path d={edge(0, 3)} />
          <path d={edge(3, 2)} />
        </g>
      </g>
      <g
        className="text-primary"
        stroke="currentColor"
        strokeWidth={stroke * 0.8}
        strokeLinejoin="round"
      >
        {cuboids.map((c, i) => {
          const f = faces(c);
          // Each face is painted on the page's paper first, so the cell lines and the boxes
          // behind do not show through; then the ink tint, as the holomodel's body (ADR-020).
          return (
            <g key={i}>
              {[f.top, f.along, f.across].map((d, j) => (
                <path
                  key={j}
                  d={d}
                  stroke="none"
                  style={{ fill: "var(--bg-inset)" }}
                />
              ))}
              <path d={f.top} fill="currentColor" fillOpacity={0.14} />
              <path d={f.along} fill="currentColor" fillOpacity={0.3} />
              <path d={f.across} fill="currentColor" fillOpacity={0.44} />
            </g>
          );
        })}
      </g>
      {/* The near edges of the wire box, painted last: a box that leaves a remainder of the
          grid's width or length stands in front of nothing, and the grid's edge stays in view. */}
      <g
        className="text-primary"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinejoin="round"
      >
        <path d={edge(0, 1)} />
        <path d={edge(1, 2)} />
        <path d={edge(0, 4)} />
        <path d={edge(1, 5)} />
        <path d={edge(2, 6)} />
        <path d={edge(4, 5)} />
        <path d={edge(5, 6)} />
        <path d={edge(6, 7)} />
        <path d={edge(7, 4)} />
      </g>
    </svg>
  );
}

export function CargoGrids({
  shipName,
  groups,
  boxes,
  defaultScu,
  label,
  version,
  boxesVersion,
}: CargoGridsProps) {
  const [scu, setScu] = useState(defaultScu);
  const captionId = useId();
  const box = boxes.find((b) => b.scu === scu) ?? boxes[0]!;
  const total = groups.reduce((s, g) => s + g.grid.scu * g.count, 0);
  const held = scuHeld(groups, box);
  const count = groups.reduce(
    (s, g) => s + fitOf(g.grid, box).count * g.count,
    0,
  );
  // One scale for every grid of the ship, so a small grid is drawn small beside a large one.
  const widest = Math.max(
    ...groups.map((g) => (g.grid.width + g.grid.length) * COS + 0.8),
  );
  const scale = Math.max(6, Math.min(22, 560 / widest));

  return (
    <figure className="m-0 flex flex-col gap-3" aria-describedby={captionId}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-0 max-w-full items-center gap-2 text-caption text-secondary">
          <span className="shrink-0">Boxes of</span>
          <select
            aria-label="Box size"
            value={scu}
            onChange={(event) => setScu(Number(event.target.value))}
            className="min-w-0 max-w-full rounded-pill border border-hairline-strong bg-surface px-3 py-1 text-caption text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {boxes.map((b) => (
              <option key={b.scu} value={b.scu}>
                {b.scu} SCU, {n2(b.width_m)} × {n2(b.length_m)} ×{" "}
                {n2(b.height_m)} m
              </option>
            ))}
          </select>
        </label>
        <p className="m-0 text-caption text-secondary tabular-nums">
          {count === 0
            ? `No ${box.scu} SCU box stands on any grid of the ${shipName}.`
            : `${n0(count)} ${plural(count, "box", "boxes")} of ${box.scu} SCU, ${n0(held)} of the ${n0(total)} SCU on record.`}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
        {groups.map((g, i) => {
          const fit = fitOf(g.grid, box);
          const name = `Grid ${i + 1}${g.count > 1 ? `, ×${g.count}` : ""}`;
          const dims = `${n2(g.grid.width)} × ${n2(g.grid.length)} × ${n2(g.grid.height)} m`;
          const takes =
            g.grid.maxBox === null
              ? `, largest box not stated${g.grid.minBox === null ? "" : `, ${g.grid.minBox} SCU the smallest`}`
              : `, takes ${g.grid.minBox === null ? "up to" : `${g.grid.minBox} to`} ${g.grid.maxBox} SCU boxes`;
          const holds = gridTakes(g.grid, box)
            ? fit.count === 0
              ? `; no ${box.scu} SCU box fits its ${dims}`
              : `; holds ${fit.count} ${plural(fit.count, "box", "boxes")}, ${fit.across} across, ${fit.along} along${fit.layers > 1 ? `, ${fit.layers} high` : ""}${fit.turned ? ", turned" : ""}`
            : `; does not take a ${box.scu} SCU box`;
          const title = `${name}: ${n0(g.grid.scu)} SCU, ${dims}${g.grid.external === true ? ", open to space" : ""}${takes}${holds}`;
          return (
            <div key={i} className="flex min-w-0 flex-col gap-2">
              <GridDrawing
                grid={g.grid}
                box={box}
                fit={fit}
                scale={scale}
                title={title}
              />
              <p className="m-0 text-caption text-secondary tabular-nums">
                <span className="text-primary">{name}</span> {n0(g.grid.scu)}{" "}
                SCU, {dims}
                {g.grid.external === true ? ", open to space" : ""}
                {takes}
                {holds}
              </p>
            </div>
          );
        })}
      </div>

      <table className="w-full border-collapse text-caption tabular-nums">
        <caption className="text-left text-caption text-secondary">
          Boxes that stand on each grid, by size
        </caption>
        <thead>
          <tr className="border-b border-hairline-strong text-left text-secondary">
            <th scope="col" className="py-1 pr-3 font-medium">
              Grid
            </th>
            {boxes.map((b) => (
              <th
                key={b.scu}
                scope="col"
                className="py-1 pr-3 text-right font-medium"
              >
                {b.scu} SCU
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={i} className="border-b border-hairline">
              <th
                scope="row"
                className="py-1 pr-3 text-left font-medium text-primary"
              >
                Grid {i + 1}
                {g.count > 1 ? ` (×${g.count})` : ""}
              </th>
              {boxes.map((b) => {
                const c = fitOf(g.grid, b).count;
                return (
                  <td key={b.scu} className="py-1 pr-3 text-right text-primary">
                    {c === 0 ? (
                      <span className="text-secondary">–</span>
                    ) : (
                      n0(c)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <figcaption id={captionId} className="text-caption text-secondary">
        <span className="font-mono text-primary">{label}</span> The {shipName}
        &apos;s cargo grids as its record gives them, each in cells of one SCU,
        seen from a corner, holding boxes of one standard size: as many as stand
        upright in rows across and along the grid, turned a quarter where that
        fits more, in as many layers as the height takes, within the smallest
        and largest box the record names for the grid, or any size where it
        names none. The boxes&apos; shapes come from the game&apos;s cargo
        container records. Not modelled: the game&apos;s own placement, mixed
        loads, doors and loading access, and anything tested in play
        {version === null ? "" : `. LIVE ${version}`}
        {boxesVersion === null || boxesVersion === version
          ? ""
          : `; the box shapes from ${boxesVersion}`}
      </figcaption>
    </figure>
  );
}
