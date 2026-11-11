/**
 * Design tokens. Every value in docs/design/system.md section 2 lives here and nowhere else
 * (CLAUDE.md sections 2 and 7). `tokens.css` is generated from this file by
 * `pnpm --filter ui build:tokens`; a unit test fails when the generated file is stale and another
 * fails when a value here drifts from the table in the design document. Changing any value needs
 * an ADR. The current values are the gallery's (ADR-021).
 */

export const colorTokens = [
  "bg.page",
  "bg.surface",
  "bg.raised",
  "bg.inset",
  "text.primary",
  "text.secondary",
  "text.muted",
  "text.on-art",
  "scrim",
  "border.default",
  "border.strong",
  "accent",
  "accent.bg",
  "success",
  "warning",
  "danger",
  "spectrum.staff",
  "brand.copper",
] as const;
export type ColorToken = (typeof colorTokens)[number];

export type Scheme = "light" | "dark";

/**
 * The Tailwind color name for each token: `bg-page`, `text-secondary`, `border-hairline`. The
 * utility prefix already says what the color is for, so the token's group is dropped.
 */
export const colorUtility: Record<ColorToken, string> = {
  "bg.page": "page",
  "bg.surface": "surface",
  "bg.raised": "raised",
  "bg.inset": "inset",
  "text.primary": "primary",
  "text.secondary": "secondary",
  "text.muted": "muted",
  "text.on-art": "on-art",
  scrim: "scrim",
  "border.default": "hairline",
  "border.strong": "hairline-strong",
  accent: "accent",
  "accent.bg": "accent-bg",
  success: "success",
  warning: "warning",
  danger: "danger",
  "spectrum.staff": "spectrum-staff",
  "brand.copper": "brand-copper",
};

export const color: Record<Scheme, Record<ColorToken, string>> = {
  // The gallery (ADR-021): warm white walls and white cards by day, charcoal by night; the ink
  // of the almanac stay; the accent is periwinkle since ADR-032, and a developer post carries
  // Spectrum's own yellow as a mark. Surfaces separate by tone and shadow, not frames.
  light: {
    "bg.page": "#F6F4EF",
    "bg.surface": "#FFFFFF",
    "bg.raised": "#FFFFFF",
    "bg.inset": "#ECE9E2",
    "text.primary": "#1A1917",
    "text.secondary": "#5A5852",
    "text.muted": "#67635B",
    "text.on-art": "#F6F4EF",
    scrim: "rgba(12,11,10,0.78)",
    "border.default": "rgba(26,25,23,0.10)",
    "border.strong": "rgba(26,25,23,0.24)",
    accent: "#4A5AD3",
    "accent.bg": "#E3E6FA",
    success: "#2F6B3A",
    warning: "#8A5A00",
    danger: "#B3261E",
    "spectrum.staff": "#DEC342",
    // The site's own colour (ADR-041): the mark and the favicon alone.
    "brand.copper": "#A8652F",
  },
  dark: {
    "bg.page": "#161513",
    "bg.surface": "#1F1E1B",
    "bg.raised": "#262522",
    "bg.inset": "#272622",
    "text.primary": "#F1EEE6",
    "text.secondary": "#B5B1A6",
    "text.muted": "#9B968B",
    "text.on-art": "#F6F4EF",
    scrim: "rgba(12,11,10,0.78)",
    "border.default": "rgba(241,238,230,0.10)",
    "border.strong": "rgba(241,238,230,0.24)",
    accent: "#98A4F4",
    "accent.bg": "#2A2E4A",
    success: "#6FBF7F",
    warning: "#E0A94A",
    danger: "#EF7A6E",
    "spectrum.staff": "#DEC342",
    "brand.copper": "#D08A4F",
  },
};

export const typeTokens = [
  "hero",
  "display",
  "title",
  "heading",
  "body",
  "ui",
  "caption",
  "label",
] as const;
export type TypeToken = (typeof typeTokens)[number];

export interface TypeStyle {
  /** px */
  readonly size: number;
  /** px */
  readonly line: number;
  /** The default weight; `ui` may also use `weight.medium`. */
  readonly weight: 400 | 500;
}

export const type: Record<TypeToken, TypeStyle> = {
  // The large sizes are set regular and tight (ADR-021): the face carries them; emphasis is medium.
  hero: { size: 80, line: 84, weight: 400 },
  display: { size: 40, line: 44, weight: 400 },
  title: { size: 28, line: 34, weight: 400 },
  heading: { size: 20, line: 26, weight: 500 },
  body: { size: 16, line: 26, weight: 400 },
  ui: { size: 14, line: 20, weight: 400 },
  caption: { size: 12.5, line: 18, weight: 400 },
  /** Small labels (`.lab`): eyebrows, column heads, counters' names; sentence case, medium. */
  label: { size: 12, line: 16, weight: 500 },
};

/** The only two weights on any page. */
export const weight = { regular: 400, medium: 500 } as const;

/**
 * ADR-021 (replacing ADR-020's serifs): one face, Manrope, for text, display and figures, with
 * tabular numerals everywhere a number is set. Loaded by the app with next/font/google. The three
 * slots stay so `font-sans`, `font-display` and `font-mono` keep their meaning in the components.
 */
export const font = {
  sans: {
    family: "Manrope",
    cssVariable: "--font-manrope",
    fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  display: {
    family: "Manrope",
    cssVariable: "--font-manrope",
    fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  mono: {
    family: "Manrope",
    cssVariable: "--font-manrope",
    fallback: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
} as const;

/** px. Nothing in between. */
export const space = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

/** px. Nothing else. Soft corners (ADR-021); `pill` rounds a control fully. */
export const radius = {
  control: 10,
  card: 20,
  palette: 20,
  pill: 999,
} as const;

/**
 * Elevation (ADR-021): cards and panels sit on the page by tone and a soft shadow, not a frame;
 * `lift` is the hero card's and the command palette's; `popover` the menus'.
 */
export const shadow = {
  soft: "0 10px 30px rgba(26,25,23,0.08)",
  lift: "0 24px 64px rgba(26,25,23,0.14), 0 2px 6px rgba(26,25,23,0.06)",
  popover: "0 16px 48px rgba(26,25,23,0.18)",
} as const;

export const layout = { contentMaxWidth: 1400, proseMaxWidth: "68ch" } as const;

export const motion = {
  /** ms */
  duration: { hover: 120, panel: 200, viewer: 320 },
  easing: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export const tokens = {
  color,
  type,
  weight,
  font,
  space,
  radius,
  shadow,
  layout,
  motion,
} as const;
export type Tokens = typeof tokens;

/** `bg.page` → `bg-page`: the name used for CSS variables and Tailwind utilities. */
export const cssName = (token: string): string => token.replace(/\./g, "-");
