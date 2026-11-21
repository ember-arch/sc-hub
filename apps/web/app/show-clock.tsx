"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * When an open page asks the site for itself again after a show's day changes (ADR-057, amended
 * 2026-11-15). Vercel rebuilds the page on the first ask after the change, at most once a minute,
 * so the page asks quickly at first; then once a minute, for a browser whose clock runs fast, until
 * half an hour past the change; and a few times for a page that was already long stale when it was
 * opened or came back into view.
 */
export const SHOW_CLOCK_QUICK_MS = 20_000;
export const SHOW_CLOCK_QUICK_TRIES = 15;
export const SHOW_CLOCK_SLOW_MS = 60_000;
export const SHOW_CLOCK_KEEP_MS = 30 * 60_000;
export const SHOW_CLOCK_LATE_TRIES = 3;
/** Never more asks than this in one view of the page. */
export const SHOW_CLOCK_MAX_TRIES = 45;
/** The longest a browser timer waits (about 24.8 days); a later change is looked at again then. */
const LONGEST_TIMER_MS = 2 ** 31 - 1;

export type ShowClockStep =
  | { readonly kind: "wait"; readonly ms: number }
  | { readonly kind: "ask"; readonly then: number }
  | { readonly kind: "stop" };

/**
 * What the clock does at `now`, the change being due at `due` and `tries` asks made in this view:
 * wait for the change (a second past it, so the site's clock has passed it too), ask and look again
 * after `then`, or stop. Pure, so the tests can walk it.
 */
export function showClockStep(
  due: number,
  now: number,
  tries: number,
): ShowClockStep {
  const late = now - due;
  if (late < 0) {
    return { kind: "wait", ms: Math.min(1_000 - late, LONGEST_TIMER_MS) };
  }
  if (tries >= SHOW_CLOCK_MAX_TRIES) return { kind: "stop" };
  if (late > SHOW_CLOCK_KEEP_MS && tries >= SHOW_CLOCK_LATE_TRIES) {
    return { kind: "stop" };
  }
  return {
    kind: "ask",
    then:
      tries + 1 < SHOW_CLOCK_QUICK_TRIES
        ? SHOW_CLOCK_QUICK_MS
        : SHOW_CLOCK_SLOW_MS,
  };
}

/**
 * Keeps an open page on the show's day (ADR-057, amended 2026-11-15). `next` is the moment the page
 * goes stale: the next time a show on file changes phase, such as a day opening at RSI's
 * change-over (16:00 UTC for IAE 2956, 8:00 in the Pacific). When it passes, or had passed when the
 * page loaded, the page asks the site for itself again (`showClockStep` says how often); the new
 * page brings a later `next` and the clock starts over. The browser never decides the day. Renders
 * nothing.
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
      const step = showClockStep(due, Date.now(), tries);
      if (step.kind === "stop") return;
      if (step.kind === "wait") {
        timer = setTimeout(check, step.ms);
        return;
      }
      tries += 1;
      router.refresh();
      timer = setTimeout(check, step.then);
    };
    check();
    // A timer in a background tab can fire late or not at all: coming back into view is a fresh
    // look, with its own asks.
    const onVisible = (): void => {
      if (document.visibilityState !== "visible") return;
      tries = 0;
      check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [next, router]);
  return null;
}
