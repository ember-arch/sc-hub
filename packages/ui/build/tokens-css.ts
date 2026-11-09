import {
  color,
  colorTokens,
  colorUtility,
  cssName,
  font,
  layout,
  motion,
  radius,
  shadow,
  space,
  type,
  typeTokens,
  weight,
} from "../tokens";

/**
 * Renders `tokens.css`, the Tailwind v4 theme generated from `tokens.ts` (CLAUDE.md section 7:
 * "Tailwind config is generated from them"). Three parts:
 *
 * 1. Scheme variables (`--bg-page` and friends) on `:root`, switched by the system preference and
 *    overridable by `data-theme` on any element: the theme switch sets it on `<html>` (ADR-021) and
 *    a well can set it on itself (the honours' slate wells).
 * 2. An `@theme inline` block that maps those variables onto Tailwind's namespaces and resets every
 *    default palette, size, radius and shadow, so a class outside the token set produces no CSS.
 * 3. Utilities for the three motion durations.
 */
export function renderTokensCss(): string {
  const lines: string[] = [];
  const push = (s = ""): void => {
    lines.push(s);
  };

  push(
    "/* Generated from packages/ui/tokens.ts by `pnpm --filter ui build:tokens`. Do not edit. */",
  );
  push();

  const schemeBlock = (scheme: "light" | "dark", indent: string): void => {
    for (const token of colorTokens) {
      push(`${indent}--${cssName(token)}: ${color[scheme][token]};`);
    }
    push(`${indent}color-scheme: ${scheme};`);
  };

  push(':root,\n[data-theme="light"] {');
  schemeBlock("light", "  ");
  push("}");
  push();
  push("@media (prefers-color-scheme: dark) {");
  push('  :root:not([data-theme="light"]) {');
  schemeBlock("dark", "    ");
  push("  }");
  push("}");
  push();
  push('[data-theme="dark"] {');
  schemeBlock("dark", "  ");
  push("}");
  push();

  push("@theme inline {");
  push("  --color-*: initial;");
  for (const token of colorTokens) {
    push(`  --color-${colorUtility[token]}: var(--${cssName(token)});`);
  }
  push();
  push("  --font-*: initial;");
  push(`  --font-sans: var(${font.sans.cssVariable}), ${font.sans.fallback};`);
  push(
    `  --font-display: var(${font.display.cssVariable}), ${font.display.fallback};`,
  );
  push(`  --font-mono: var(${font.mono.cssVariable}), ${font.mono.fallback};`);
  push();
  push("  --text-*: initial;");
  for (const token of typeTokens) {
    const t = type[token];
    push(`  --text-${token}: ${t.size}px;`);
    push(`  --text-${token}--line-height: ${t.line}px;`);
    push(`  --text-${token}--font-weight: ${t.weight};`);
  }
  push();
  push("  --font-weight-*: initial;");
  push(`  --font-weight-regular: ${weight.regular};`);
  push(`  --font-weight-medium: ${weight.medium};`);
  push();
  push("  --spacing: initial;");
  push("  --spacing-*: initial;");
  // Zero is not a spacing token but every `inset-0`, `top-0` and `m-0` needs it once the
  // multiplier is gone (ADR-005).
  push("  --spacing-0: 0px;");
  for (const px of space) {
    push(`  --spacing-${px / 4}: ${px}px;`);
  }
  push();
  push("  --radius-*: initial;");
  for (const [name, px] of Object.entries(radius)) {
    push(`  --radius-${name}: ${px}px;`);
  }
  push();
  push("  --shadow-*: initial;");
  push("  --inset-shadow-*: initial;");
  push("  --drop-shadow-*: initial;");
  push("  --text-shadow-*: initial;");
  for (const [name, value] of Object.entries(shadow)) {
    push(`  --shadow-${name}: ${value};`);
  }
  push();
  push("  --container-*: initial;");
  push(`  --container-content: ${layout.contentMaxWidth}px;`);
  push(`  --container-prose: ${layout.proseMaxWidth};`);
  push();
  push("  --ease-*: initial;");
  push(`  --ease-standard: ${motion.easing};`);
  push(`  --default-transition-duration: ${motion.duration.hover}ms;`);
  push("  --default-transition-timing-function: var(--ease-standard);");
  push();
  push("  --animate-*: initial;");
  push("  --blur-*: initial;");
  push("  --perspective-*: initial;");
  push("}");
  push();

  for (const [name, ms] of Object.entries(motion.duration)) {
    push(`@utility duration-${name} {`);
    push(`  transition-duration: ${ms}ms;`);
    push("  transition-timing-function: var(--ease-standard);");
    push("}");
    push();
  }

  push("@layer base {");
  push("  html {");
  push("    background: var(--bg-page);");
  push("    color: var(--text-primary);");
  push("    font-family: var(--font-sans);");
  push("    font-variant-numeric: tabular-nums;");
  push("    -webkit-font-smoothing: antialiased;");
  push("  }");
  // Display type (ADR-021): the large sizes are set tight; headings a little; labels are small
  // medium text in sentence case.
  push("  .text-hero,");
  push("  .text-display,");
  push("  .text-title {");
  push("    letter-spacing: -0.03em;");
  push("  }");
  push("  .text-heading {");
  push("    letter-spacing: -0.01em;");
  push("  }");
  push("  .lab {");
  push(`    font-size: ${type.label.size}px;`);
  push(`    line-height: ${type.label.line}px;`);
  push(`    font-weight: ${type.label.weight};`);
  push("  }");
  push("  @media (prefers-reduced-motion: reduce) {");
  push("    *,");
  push("    ::before,");
  push("    ::after {");
  push("      transition-duration: 0ms !important;");
  push("      animation-duration: 0ms !important;");
  push("    }");
  push("  }");
  push("}");

  return `${lines.join("\n")}\n`;
}
