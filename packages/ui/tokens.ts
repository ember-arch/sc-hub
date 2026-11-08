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
  light: {
    "bg.page": "#F7F7F5",
    "bg.surface": "#FFFFFF",
    "bg.raised": "#FFFFFF",
    "bg.inset": "#EFEFEC",
    "text.primary": "#131416",
    "text.secondary": "#5C5F66",
    "text.muted": "#696D74",
    "border.default": "rgba(0,0,0,0.10)",
    "border.strong": "rgba(0,0,0,0.20)",
    accent: "#2560E8",
    "accent.bg": "#E8EFFF",
    success: "#1A7A43",
    warning: "#9A5B00",
    danger: "#C7352B",
  },
  dark: {
    "bg.page": "#0C0D0F",
    "bg.surface": "#141619",
    "bg.raised": "#1B1E22",
    "bg.inset": "#0F1012",
    "text.primary": "#F2F2F0",
    "text.secondary": "#A2A6AD",
    "text.muted": "#82868E",
    "border.default": "rgba(255,255,255,0.10)",
    "border.strong": "rgba(255,255,255,0.18)",
    accent: "#5B8CFF",
    "accent.bg": "#17223D",
    success: "#3DBA6E",
    warning: "#E0962B",
    danger: "#E5574D",
  },
};

export const typeTokens = [
  "display",
  "title",
  "heading",
  "body",
  "ui",
  "caption",
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
  display: { size: 40, line: 44, weight: 500 },
  title: { size: 28, line: 34, weight: 500 },
  heading: { size: 20, line: 28, weight: 500 },
  body: { size: 16, line: 26, weight: 400 },
  ui: { size: 14, line: 20, weight: 400 },
  caption: { size: 12.5, line: 18, weight: 400 },
};

/** The only two weights on any page. */
export const weight = { regular: 400, medium: 500 } as const;

/** ADR-005: Geist Sans for interface text, Geist Mono for numbers. Loaded by the app with next/font. */
export const font = {
  sans: {
    family: "Geist Sans",
    cssVariable: "--font-geist-sans",
    fallback: "ui-sans-serif, system-ui, sans-serif",
  },
  mono: {
    family: "Geist Mono",
    cssVariable: "--font-geist-mono",
    fallback: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
} as const;

/** px. Nothing in between. */
export const space = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

/** px. Nothing else. */
export const radius = { control: 6, card: 10, palette: 14 } as const;

/** Elevation is otherwise none: hairline borders only. */
export const shadow = { popover: "0 8px 24px rgba(0,0,0,0.12)" } as const;

export const layout = { contentMaxWidth: 1200, proseMaxWidth: "68ch" } as const;

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
