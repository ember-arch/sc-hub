"use client";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { Footer } from "ui";
import { SITE_NAME } from "ui/brand";
import "./globals.css";

/**
 * A failure in the root layout itself bypasses `error.tsx`, so this boundary renders its own
 * `<html>` and `<body>` and still carries the verbatim fan-site notice (CLAUDE.md section 2).
 */
export default function GlobalError({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <div className="flex min-h-dvh flex-col bg-page text-primary">
          <main className="mx-auto w-full max-w-content flex-1 px-4 pb-8">
            <div className="flex max-w-prose flex-col gap-6 pt-8">
              <h1 className="text-title text-primary">Something went wrong</h1>
              <p className="text-body text-secondary">
                {SITE_NAME} could not render this page; try again or go back to
                the home page.
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={reset}
                  className="rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Try again
                </button>
                <a
                  href="/"
                  className="rounded-control border border-hairline bg-surface px-3 py-1 text-ui text-primary no-underline hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Home page
                </a>
              </div>
            </div>
          </main>
          <Footer versions={[]} wikiCredit={false} />
        </div>
      </body>
    </html>
  );
}
