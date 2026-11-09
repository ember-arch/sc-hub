/**
 * Design tokens. Every value in docs/design/system.md section 2 lives here and nowhere else
 * (CLAUDE.md sections 2 and 7). `tokens.css` is generated from this file by
 * `pnpm --filter ui build:tokens`; a unit test fails when the generated file is stale and another
 * fails when a value here drifts from the table in the design document. Changing any value needs
 * an ADR. The font pair is ADR-005.
 */

export const colorTokens = [
  "bg.page",
  "bg.surface",
  "bg.raised",
  "bg.inset",
  "text.primary",
  "text.secondary",
  "text.muted",
  "border.default",
  "border.strong",
  "accent",
  "accent.bg",
  "success",
  "warning",
  "danger",
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
  "border.default": "hairline",
  "border.strong": "hairline-strong",
  accent: "accent",
  "accent.bg": "accent-bg",
  success: "success",
  warning: "warning",
  danger: "danger",
};

export const color: Record<Scheme, Record<ColorToken, string>> = {
  // Paper and ink (ADR-020): warm paper by day, ink on slate by night.
  light: {
    "bg.page": "#F4EFE5",
    "bg.surface": "#FBF8F1",
    "bg.raised": "#FFFDF8",
    "bg.inset": "#EBE4D6",
    "text.primary": "#1C1A16",
    "text.secondary": "#57534A",
    "text.muted": "#6B665B",
    "border.default": "rgba(28,26,22,0.16)",
    "border.strong": "rgba(28,26,22,0.42)",
    accent: "#A8321F",
    "accent.bg": "#F2DED7",
    success: "#2F6B3A",
    warning: "#8A5A00",
    danger: "#B3261E",
  },
  dark: {
    "bg.page": "#1D1B17",
    "bg.surface": "#24221D",
    "bg.raised": "#2B2924",
    "bg.inset": "#17150F",
    "text.primary": "#EFE9DC",
    "text.secondary": "#B8B0A0",
    "text.muted": "#9A927F",
    "border.default": "rgba(239,233,220,0.16)",
    "border.strong": "rgba(239,233,220,0.40)",
    accent: "#E6735F",
    "accent.bg": "#4A2A22",
    success: "#6FBF7F",
    warning: "#E0A94A",
    danger: "#EF7A6E",
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
  hero: { size: 80, line: 84, weight: 500 },
  display: { size: 40, line: 44, weight: 500 },
  title: { size: 28, line: 34, weight: 500 },
  heading: { size: 20, line: 28, weight: 500 },
  body: { size: 16, line: 26, weight: 400 },
  ui: { size: 14, line: 20, weight: 400 },
  caption: { size: 12.5, line: 18, weight: 400 },
  /** The almanac's labels (ADR-020): the mono as letter-spaced capitals, through the .lab rule. */
  label: { size: 11, line: 16, weight: 400 },
};

/** The only two weights on any page. */
export const weight = { regular: 400, medium: 500 } as const;

/**
 * ADR-020 (replacing ADR-005's pair): Newsreader for text and interface, Fraunces for display
 * (titles, ship names, headline figures), IBM Plex Mono for numbers. Loaded by the app with
 * next/font/google. The `sans` slot keeps its name as the text face so every `font-sans` stays valid.
 */
export const font = {
  sans: {
    family: "Newsreader",
    cssVariable: "--font-newsreader",
    fallback: "Georgia, 'Times New Roman', serif",
  },
  display: {
    family: "Fraunces",
    cssVariable: "--font-fraunces",
    fallback: "Georgia, 'Times New Roman', serif",
  },
  mono: {
    family: "IBM Plex Mono",
    cssVariable: "--font-plex-mono",
    fallback: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
} as const;

/** px. Nothing in between. */
export const space = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

/** px. Nothing else. */
/** px. Nothing else. Square frames, as on paper (ADR-020). */
export const radius = { control: 2, card: 2, palette: 2 } as const;

/** Elevation is otherwise none: hairline borders only. */
export const shadow = { popover: "0 8px 24px rgba(28,26,22,0.14)" } as const;

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
