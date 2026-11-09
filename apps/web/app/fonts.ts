import { Manrope } from "next/font/google";

/**
 * The gallery's face (ADR-021): Manrope, one variable family for text, display and figures.
 * next/font downloads it at build time and serves it from the site, so no request leaves for a
 * font host (docs/legal/obligations.md, privacy). The CSS variable matches `font` in
 * packages/ui/tokens.ts.
 */
const manrope = Manrope({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-manrope",
  display: "swap",
});

/** The class name that defines the font variable on `<html>`. */
export const fontClasses = manrope.variable;
