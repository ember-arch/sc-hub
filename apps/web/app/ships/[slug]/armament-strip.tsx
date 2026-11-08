import type { ArmamentRow } from "../../../lib/armament";

/**
 * Guns and missiles as marks sized by their size class (ADR-008): one square per gun, one bar per
 * missile or torpedo, larger classes larger. Sizes map onto the spacing scale, so the drawing uses
 * token sizes only. The counts are written out beside the marks for screen readers and scanning.
 */

const GUN_SIZE = [
  "size-2",
  "size-2",
  "size-3",
  "size-4",
  "size-6",
  "size-6",
  "size-8",
  "size-8",
] as const;
const gunClass = (size: number): string =>
  size >= GUN_SIZE.length ? "size-12" : (GUN_SIZE[size] ?? "size-2");

const MISSILE_HEIGHT = [
  "h-3",
  "h-3",
  "h-4",
  "h-6",
  "h-6",
  "h-8",
  "h-8",
  "h-8",
  "h-12",
  "h-12",
] as const;
const missileClass = (size: number): string =>
  size >= MISSILE_HEIGHT.length ? "h-16" : (MISSILE_HEIGHT[size] ?? "h-3");

const KIND = { guns: "Guns", missiles: "Missiles and torpedoes" } as const;

export function ArmamentStrip({
  rows,
}: {
  readonly rows: readonly ArmamentRow[];
}) {
  return (
    <div className="flex flex-col gap-8">
      {rows.map((row) => (
        <div key={row.kind} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="m-0 text-ui font-medium text-primary">
              {KIND[row.kind]}{" "}
              <span className="font-mono text-secondary">{row.total}</span>
            </h3>
            <p className="m-0 text-caption text-secondary">
              {row.sizes.map((s) => `${s.count} × S${s.size}`).join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2" aria-hidden="true">
            {row.sizes.flatMap((s) =>
              Array.from({ length: s.count }, (_, i) =>
                row.kind === "guns" ? (
                  <span
                    key={`${s.size}-${i}`}
                    className={`${gunClass(s.size)} border border-accent bg-accent-bg`}
                  />
                ) : (
                  <span
                    key={`${s.size}-${i}`}
                    className={`${missileClass(s.size)} w-1 border border-hairline-strong bg-inset`}
                  />
                ),
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
