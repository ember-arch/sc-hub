import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { siteUrl } from "../lib/seo";
import { fontClasses } from "./fonts";
import "./globals.css";

// Canonical and Open Graph URLs resolve against the public origin (spec 02, "SEO"; ADR-006).
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_TAGLINE,
};

/**
 * Applies the reader's stored theme before the first paint (ADR-021), so a page never flashes the
 * other scheme. Reads the same key the switch writes; anything else leaves the system's choice.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en" className={fontClasses} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
