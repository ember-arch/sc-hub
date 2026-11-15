"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * How long an open page waits before asking again, after a change-over, while the site still
 * answers with the page built before it: Vercel builds the new one on the first ask after the
 * change, and the pages that follow a show are rebuilt at most once a minute (ADR-057, amended
 * 2026-11-15).
 */
export const SHOW_CLOCK_RETRY_MS = 20_000;
/** Asks after one change-over, at most: five minutes of them. */
export const SHOW_CLOCK_TRIES = 15;
/** The longest a browser timer waits (about 24.8 days); a later change is looked at again then. */
const LONGEST_TIMER_MS = 2 ** 31 - 1;

/**
 * Keeps an open page on the show's day (ADR-057, amended 2026-11-15). `next` is the moment the page
 * goes stale: the next time a show on file changes phase, such as a day opening at RSI's
 * change-over (16:00 UTC for IAE 2956, 8:00 in the Pacific). When it passes, or the page was already
 * stale when it loaded, the page asks the site for itself again; the new page brings a later
 * `next`. Renders nothing.
 */
export function ShowClock({ next }: { readonly next: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (next === null) return;
    const due = Date.parse(next);
    if (Number.isNaN(due)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const check = (): void => {
      clearTimeout(timer);
      const wait = due - Date.now();
      if (wait > 0) {
        // A second past the change, so the site's clock has passed it too.
        timer = setTimeout(check, Math.min(wait + 1_000, LONGEST_TIMER_MS));
        return;
      }
      if (tries >= SHOW_CLOCK_TRIES) return;
      tries += 1;
      router.refresh();
      // Until a page with a later `next` arrives (and this starts over), ask again.
      timer = setTimeout(check, SHOW_CLOCK_RETRY_MS);
    };
    check();
    // A timer in a background tab can fire late or not at all; look again on coming back.
    const onVisible = (): void => {
      if (document.visibilityState === "visible" && Date.now() >= due) check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [next, router]);
  return null;
}
