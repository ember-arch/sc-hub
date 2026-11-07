"use client";

import { Footer } from "ui";
import { SITE_NAME } from "ui/brand";

/**
 * Server and render errors (ADR-005 audit deferral): say what happened and what to do, one
 * sentence, no first person (system.md section 5), and keep the disclaimer in the footer
 * (CLAUDE.md section 2). An error boundary is a client component and cannot read the pack, so
 * the footer's patch strip shows its empty state here.
 */
export default function ErrorPage({
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-page text-primary">
      <main className="mx-auto w-full max-w-content flex-1 px-4 pb-8">
        <div className="flex max-w-prose flex-col gap-6 pt-8">
          <h1 className="text-title text-primary">Something went wrong</h1>
          <p className="text-body text-secondary">
            {SITE_NAME} could not render this page; try again or go back to the
            home page.
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
  );
}
