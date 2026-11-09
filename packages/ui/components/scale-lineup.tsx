/**
 * Ships to scale (ADR-008): side profiles drawn from each ship's length and height, nested from
 * the same nose point, largest at the back, with a person for reference. The shapes are bounding
 * profiles from the data, not silhouettes; the page's own ship is filled in the accent. Pure SVG,
 * server-rendered; a legend lists every outline because text inside a scaled SVG is unreadable on
 * a phone.
 */

export interface ScaleItem {
  readonly key: string;
  readonly name: string;
  /** Metres. */
  readonly length: number;
  /** Metres. */
  readonly height: number;
  readonly current?: boolean | undefined;
}

export interface ScaleLineupProps {
  readonly items: readonly ScaleItem[];
  /** A human-scale reference drawn beside the ships, for example a person 1.8 m tall. */
  readonly reference?: ScaleItem | undefined;
  /** Read by assistive tech in place of the drawing. */
  readonly label: string;
}

const W = 1000;
const PAD = 4;

/**
 * A generic hull profile inside a length-by-height box, nose to the left: a tapered nose, a raised
 * spine and a cut tail. The same glyph for every ship, so only the proportions carry data.
 */
function hull(x: number, ground: number, w: number, h: number): string {
  const p = (fx: number, fy: number): string =>
    `${(x + fx * w).toFixed(2)},${(ground - fy * h).toFixed(2)}`;
  return `M${p(0, 0.3)} L${p(0.18, 0.62)} L${p(0.42, 1)} L${p(0.86, 1)} L${p(1, 0.78)} L${p(1, 0)} L${p(0.06, 0)} Z`;
}

export function ScaleLineup({ items, reference, label }: ScaleLineupProps) {
  const all = reference === undefined ? items : [...items, reference];
  const maxLength = Math.max(...all.map((i) => i.length));
  const maxHeight = Math.max(...all.map((i) => i.height));
  const scale = (W - PAD * 2) / maxLength;
  const ground = PAD + maxHeight * scale;
  const height = ground + PAD;
  // Back to front: the longest first so every smaller outline stays visible on top of it.
  const drawn = [...all].sort((a, b) => b.length - a.length);
  const legend = [...all].sort((a, b) => b.length - a.length);
  return (
    <figure className="m-0 flex flex-col gap-4">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={label}
      >
        <line
          x1={0}
          x2={W}
          y1={ground}
          y2={ground}
          className="stroke-hairline-strong"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {drawn.map((item) => {
          const w = Math.max(item.length * scale, 1);
          const h = Math.max(item.height * scale, 1);
          const isReference = item === reference;
          const className =
            item.current === true
              ? "fill-accent-bg stroke-accent"
              : isReference
                ? "fill-primary stroke-primary"
                : "fill-none stroke-hairline-strong";
          if (isReference) {
            return (
              <rect
                key={item.key}
                x={PAD}
                y={ground - h}
                width={w}
                height={h}
                className={className}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          return (
            <path
              key={item.key}
              d={hull(PAD, ground, w, h)}
              className={className}
              strokeWidth={item.current === true ? 2 : 1}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <figcaption className="flex flex-col gap-2">
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0 text-caption text-secondary">
          {legend.map((item) => (
            <li
              key={item.key}
              className={item.current === true ? "text-accent" : undefined}
            >
              {item.name}{" "}
              <span className="font-mono">
                {(item === reference
                  ? item.height
                  : item.length
                ).toLocaleString("en-US", { maximumFractionDigits: 1 })}
              </span>{" "}
              {item === reference ? "m tall" : "m long"}
            </li>
          ))}
        </ul>
        <p className="m-0 text-caption text-secondary">
          Outlines show each ship&apos;s length and height, not its shape.
        </p>
      </figcaption>
    </figure>
  );
}
