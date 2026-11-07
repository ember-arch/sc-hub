import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { SITE_NAME, SITE_TAGLINE } from "ui/brand";
import { siteUrl } from "../lib/seo";
import "./globals.css";

// Canonical and Open Graph URLs resolve against the public origin (spec 02, "SEO"; ADR-006).
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE_NAME, template: `%s — ${SITE_NAME}` },
  description: SITE_TAGLINE,
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
