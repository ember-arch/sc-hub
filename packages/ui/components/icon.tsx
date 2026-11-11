/**
 * The site's icons (ADR-044): one small set of line glyphs, drawn in the colour of the text
 * beside them (`currentColor`) with a 1.5 stroke on a 24-unit grid, at 16 px beside interface
 * text and 24 px where a figure needs a larger mark. An icon always stands beside its label,
 * never in place of it, so it is hidden from assistive tech; it carries no colour, fill, glow or
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
  physical: ["M4 9.5h9.5l5.5 2.5-5.5 2.5H4z", "M8.5 9.5v5"],
  // An energy bolt.
  energy: ["M13.5 3 6 13.5h5.5L10.5 21 18 10.5h-5.5z"],
  // Two waves: distortion.
  distortion: [
    "M3 9.5c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0",
    "M3 14.5c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0",
  ],
  // One shot: a crosshair.
  shot: ["M12 4v4", "M12 16v4", "M4 12h4", "M16 12h4", "M12 12h.01"],
  // A shield.
  shield: ["M12 3.5 19 6v5c0 4.5-3 8-7 9.5C8 19 5 15.5 5 11V6z"],
  // Passing through: an arrow across a line.
  through: ["M4 12h15", "M15 8l4 4-4 4", "M10 5v14"],
  // Plate armour: two overlapping plates with their rivets.
  armour: [
    "M4.5 5.5h15v6h-15z",
    "M4.5 12.5h15v6h-15z",
    "M7.5 8.5h.01",
    "M16.5 8.5h.01",
    "M7.5 15.5h.01",
    "M16.5 15.5h.01",
  ],
  // The hull: a ship seen from above, nose up.
  hull: ["M12 3 16.5 12 15.5 20h-7L7.5 12z", "M9 13h6"],
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
    "M12 5l-1.8-1.4",
    "M12 5l-1.8 1.4",
  ],
  // Yaw: a turn about the vertical axis (the line), drawn as the arrow around it.
  yaw: ["M12 3.5v17", "M12 8a7 4 0 1 1-7 4", "M5 12l-1.4 1.8", "M5 12l1.4 1.8"],
  // Roll: a turn about the nose's own axis (the point), drawn as the circle around it.
  roll: [
    "M12 12h.01",
    "M12 5a7 7 0 1 0 7 7",
    "M19 12l-1.6-2",
    "M19 12l1.5-2.1",
  ],
  // The next stage.
  next: ["M9.5 6l6 6-6 6"],
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
