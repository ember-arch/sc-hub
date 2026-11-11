/**
 * The site's icons (ADR-044): one small set of line glyphs, drawn in the colour of the text
 * beside them (`currentColor`) with a 1.5 stroke on a 24-unit grid, at 16 px beside interface
 * text (24 px is there for a larger mark; nothing uses it yet but the story). An icon always stands beside its label,
 * never in place of it, so it is hidden from assistive tech (the one exception, on the owner's
 * word: the front page's carousel arrows in `rail.tsx`, whose buttons carry the name); it carries no colour, fill, glow or
 * shadow of its own (CLAUDE.md section 2), and nothing here is an emoji.
 */

export const ICON_NAMES = [
  "physical",
  "energy",
  "distortion",
  "shot",
  "shield",
  "through",
  "armour",
  "hull",
  "components",
  "pitch",
  "yaw",
  "roll",
  "next",
] as const;
export type IconName = (typeof ICON_NAMES)[number];

/** Each glyph's strokes, as SVG path data on a 24-unit grid. */
const GLYPHS: Readonly<Record<IconName, readonly string[]>> = {
  // A ballistic round seen from the side, nose to the right, with its case line.
  physical: ["M3.5 8.5h11l6 3.5-6 3.5h-11z", "M8.5 8.5v7"],
  // An energy bolt.
  energy: ["M13.5 3 6 13.5h5.5L10.5 21 18 10.5h-5.5z"],
  // Distortion: one wave.
  distortion: ["M3 12c1.75-5 3.5-5 5.25 0s3.5 5 5.25 0 3.5-5 5.25 0"],
  // One shot: a crosshair.
  shot: ["M12 4v4", "M12 16v4", "M4 12h4", "M16 12h4", "M12 12h.01"],
  // A shield.
  shield: ["M12 3.5 19 6v5c0 4.5-3 8-7 9.5C8 19 5 15.5 5 11V6z"],
  // Passing through: an arrow across a line.
  through: ["M4 12h15", "M15 8l4 4-4 4", "M10 5v14"],
  // Plate armour: an upper plate overlapping the one below, each with its rivets.
  armour: [
    "M4.5 4.5h15v8h-15z",
    "M4.5 12.5v7h15v-7",
    "M8.5 8.5a1 1 0 1 1-2 0a1 1 0 1 1 2 0",
    "M17.5 8.5a1 1 0 1 1-2 0a1 1 0 1 1 2 0",
    "M8.5 16a1 1 0 1 1-2 0a1 1 0 1 1 2 0",
    "M17.5 16a1 1 0 1 1-2 0a1 1 0 1 1 2 0",
  ],
  // The hull: a ship seen from above, nose up, wings swept.
  hull: ["M12 3l2 5.5 6.5 4.5v2l-6.5-1.5-1 5.5h-2l-1-5.5L3.5 15v-2L10 8.5z"],
  // Components: a chip with its pins.
  components: [
    "M8 8h8v8H8z",
    "M10.5 5v3",
    "M13.5 5v3",
    "M10.5 16v3",
    "M13.5 16v3",
    "M5 10.5h3",
    "M5 13.5h3",
    "M16 10.5h3",
    "M16 13.5h3",
  ],
  // Pitch: a turn about the wings' axis (the line), drawn as the arrow around it.
  pitch: [
    "M3.5 12h17",
    "M16 12a4 7 0 1 1-4-7",
    "M12 5l-2.4-1.8",
    "M12 5l-2.4 1.8",
  ],
  // Yaw: a turn about the vertical axis (the line), drawn as the arrow around it.
  yaw: ["M12 3.5v17", "M12 8a7 4 0 1 1-7 4", "M5 12l-1.8 2.4", "M5 12l1.8 2.4"],
  // Roll: a turn about the nose's own axis (the point), drawn as the circle around it.
  roll: [
    "M12 12h.01",
    "M12 5a7 7 0 1 0 7 7",
    "M19 12l-1.9 2.2",
    "M19 12l1.9 2.2",
  ],
  // The next stage, centred on the grid.
  next: ["M9 6l6 6-6 6"],
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  readonly name: IconName;
  /** 16 beside interface text, 24 in a figure (spacing tokens). */
  readonly size?: 16 | 24;
  readonly className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      data-icon={name}
    >
      {GLYPHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
