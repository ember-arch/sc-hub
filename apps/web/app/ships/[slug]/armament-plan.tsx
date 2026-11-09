import { TextLink, formatNumber } from "ui";
import type {
  ArmamentKind,
  ArmamentLine,
  ArmamentMount,
} from "../../../lib/armament";

/**
 * The armament by who fires it (ADR-016): the pilot's guns, each turret and the missile racks, in
 * that order. Every line draws its part in profile (a gun with its receiver and barrel, a missile
 * with its nose and fins, a torpedo heavier still) at a length set by its size class on one scale
 * for the whole page, so an S5 cannon reads as bigger than an S3 repeater at a glance. Beside it:
 * the size, the part's name linked to its page, how many, and what one does.
 */

/** One scale for every drawing on the page, in drawing units per size class. */
const LENGTH = { gun: [36, 12], missile: [30, 10], torpedo: [36, 11] } as const;
const HEIGHT = {
  gun: [9, 2.2],
  missile: [7, 1.4],
  torpedo: [10, 1.8],
} as const;

const dims = (kind: ArmamentKind, size: number) => ({
  w: LENGTH[kind][0] + LENGTH[kind][1] * size,
  h: HEIGHT[kind][0] + HEIGHT[kind][1] * size,
});

/** A gun in profile, muzzle to the right: receiver, barrel, muzzle brake. */
function Gun({ size }: { readonly size: number }) {
  const { w, h } = dims("gun", size);
  const receiver = w * 0.38;
  const barrel = h * 0.36;
  return (
    <svg
      width={w}
      height={h + 2}
      viewBox={`-1 -1 ${w + 2} ${h + 2}`}
      className="shrink-0 fill-accent-bg stroke-accent"
      aria-hidden="true"
    >
      <rect
        x={0}
        y={0}
        width={receiver}
        height={h}
        rx={h * 0.18}
        strokeWidth={1}
      />
      <rect
        x={receiver}
        y={(h - barrel) / 2}
        width={w - receiver - h * 0.5}
        height={barrel}
        strokeWidth={1}
      />
      <rect
        x={w - h * 0.5}
        y={(h - barrel * 1.6) / 2}
        width={h * 0.5}
        height={barrel * 1.6}
        rx={1}
        strokeWidth={1}
      />
    </svg>
  );
}

/** A missile or torpedo in profile, nose to the right: body, ogive nose, tail fins. */
function Missile({
  size,
  torpedo,
}: {
  readonly size: number;
  readonly torpedo: boolean;
}) {
  const { w, h } = dims(torpedo ? "torpedo" : "missile", size);
  const body = h * (torpedo ? 0.62 : 0.5);
  const top = (h - body) / 2;
  const nose = w * 0.16;
  const fin = w * 0.14;
  return (
    <svg
      width={w}
      height={h + 2}
      viewBox={`-1 -1 ${w + 2} ${h + 2}`}
      className="shrink-0 fill-inset stroke-primary"
      aria-hidden="true"
    >
      <path
        d={`M0 ${top} H${w - nose} Q${w} ${h / 2} ${w - nose} ${top + body} H0 Z`}
        strokeWidth={1}
      />
      <path
        d={`M0 ${top} L${fin * 0.4} 0 L${fin} ${top} Z M0 ${top + body} L${fin * 0.4} ${h} L${fin} ${top + body} Z`}
        strokeWidth={1}
      />
      {torpedo ? (
        <line
          x1={w * 0.42}
          x2={w * 0.42}
          y1={top}
          y2={top + body}
          strokeWidth={1}
        />
      ) : null}
    </svg>
  );
}

/** Parts drawn per line, stacked like a rack; the rest are counted. */
const SHOWN = 4;

function Line({
  line,
  each,
  drawWidth,
}: {
  readonly line: ArmamentLine;
  readonly each: string;
  readonly drawWidth: number;
}) {
  const drawn = Math.min(line.count, SHOWN);
  const unit = line.kind === "gun" ? "damage per s" : "damage";
  return (
    <li className="grid grid-cols-1 items-center gap-x-6 gap-y-2 py-3 sm:grid-cols-[auto_minmax(0,1fr)]">
      <div
        className="flex flex-col items-start gap-1"
        // As wide as the mount's longest drawing, so the names line up within a mount.
        style={{ width: drawWidth }}
        aria-hidden="true"
      >
        {Array.from({ length: drawn }, (_, i) =>
          line.kind === "gun" ? (
            <Gun key={i} size={line.size} />
          ) : (
            <Missile
              key={i}
              size={line.size}
              torpedo={line.kind === "torpedo"}
            />
          ),
        )}
        {line.count > SHOWN ? (
          <span className="font-mono text-caption text-secondary">
            +{line.count - SHOWN}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-baseline gap-x-2 text-ui">
          <span className="rounded-control border border-hairline px-1 font-mono text-caption text-primary">
            S{line.size}
          </span>
          <TextLink href={`/components/${line.slug}`}>{line.name}</TextLink>
          <span className="font-mono text-secondary">×{line.count}</span>
        </span>
        <span className="text-caption text-secondary">
          {[
            line.detail,
            line.damage === null
              ? null
              : `${formatNumber(line.damage, 0)} ${unit} ${each}`.trim(),
          ]
            .filter((x) => x !== null)
            .join(" · ")}
        </span>
      </div>
    </li>
  );
}

function mountSummary(m: ArmamentMount): string {
  const guns = m.lines.filter((l) => l.kind === "gun");
  const ordnance = m.lines.filter((l) => l.kind !== "gun");
  const parts: string[] = [];
  const count = (lines: readonly ArmamentLine[]) =>
    lines.reduce((n, l) => n + l.count, 0);
  const sum = (lines: readonly ArmamentLine[]) =>
    lines.reduce((n, l) => n + (l.damage ?? 0) * l.count, 0);
  if (guns.length > 0)
    parts.push(
      `${count(guns)} ${count(guns) === 1 ? "gun" : "guns"}, ${formatNumber(sum(guns), 0)} damage per s`,
    );
  if (ordnance.length > 0) {
    const torpedoes = ordnance.every((l) => l.kind === "torpedo");
    const n = count(ordnance);
    parts.push(
      `${n} ${torpedoes ? (n === 1 ? "torpedo" : "torpedoes") : n === 1 ? "missile" : "missiles"}, ${formatNumber(sum(ordnance), 0)} damage`,
    );
  }
  return parts.join("; ");
}

export function ArmamentPlan({
  mounts,
}: {
  readonly mounts: readonly ArmamentMount[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {mounts.map((m) => (
        <section
          key={m.key}
          aria-label={m.title}
          className="rounded-card bg-surface shadow-soft px-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline py-2">
            <h3 className="m-0 text-ui font-medium text-primary">
              {m.title}
              {m.copies > 1 ? (
                <span className="font-mono text-secondary"> ×{m.copies}</span>
              ) : null}
            </h3>
            <span className="text-caption text-secondary">
              {m.copies > 1 ? "Each: " : ""}
              {mountSummary(m)}
            </span>
          </div>
          <ul className="m-0 list-none divide-y divide-hairline p-0">
            {m.lines.map((line) => (
              <Line
                key={`${line.kind}-${line.slug}`}
                line={line}
                each={line.count > 1 ? "each" : ""}
                drawWidth={Math.max(
                  ...m.lines.map((l) => dims(l.kind, l.size).w + 2),
                )}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
