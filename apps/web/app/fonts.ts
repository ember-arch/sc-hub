import { Fraunces, IBM_Plex_Mono, Newsreader } from "next/font/google";

/**
 * The almanac's faces (ADR-020): Newsreader for text, Fraunces for display (titles, ship names,
 * headline figures), IBM Plex Mono for numbers. next/font downloads them at build time and serves
 * them from the site, so no request leaves for a font host (docs/legal/obligations.md, privacy).
 * The CSS variables match `font` in packages/ui/tokens.ts.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
  display: "swap",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: "variable",
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-fraunces",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

/** The class names that define the three font variables on `<html>`. */
export const fontClasses = `${newsreader.variable} ${fraunces.variable} ${plexMono.variable}`;
