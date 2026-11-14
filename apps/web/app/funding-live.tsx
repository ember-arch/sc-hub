"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type LiveContext,
  type LiveField,
  type LiveFigures,
  liveFigures,
} from "../lib/funding-live";

/** The site's own copy of RSI's counter, regenerated at most once a minute (ADR-018, amended). */
export const LIVE_ENDPOINT = "/api/funding/live";
/**
 * How often an open page asks for it again, while the tab is in view: half the route's minute, since
 * the cache answers with the last reading while it fetches the next, so each new reading arrives
 * within the minute. The cache, not RSI, answers these.
 */
export const LIVE_EVERY_MS = 30_000;

const Figures = createContext<LiveFigures | null>(null);

function isReading(
  body: unknown,
): body is { ok: true; read_at: string; funds_usd: number; citizens: number } {
  if (body === null || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    b["ok"] === true &&
    typeof b["read_at"] === "string" &&
    !Number.isNaN(Date.parse(b["read_at"])) &&
    typeof b["funds_usd"] === "number" &&
    Number.isFinite(b["funds_usd"]) &&
    typeof b["citizens"] === "number" &&
    Number.isInteger(b["citizens"])
  );
}

/**
 * The front page's funding figures, live (ADR-018, amended 2026-11-13): on load, then every half
 * minute while the tab is in view and again when it comes back into view, the page asks the site for RSI's
 * counter and every `Live` slot below shows the figure recomputed from it. Without script, or when
 * the site has no newer reading, the page shows the figures it was built with.
 */
export function FundingLive({
  context,
  children,
}: {
  readonly context: LiveContext | null;
  readonly children: ReactNode;
}) {
  const [figures, setFigures] = useState<LiveFigures | null>(null);
  useEffect(() => {
    if (context === null) return;
    let stopped = false;
    // The newest reading shown, so a slower answer with an older one never steps the figures back.
    let shown = Date.parse(context.latestAt);
    const read = async (): Promise<void> => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch(LIVE_ENDPOINT);
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!isReading(body)) return;
        const at = Date.parse(body.read_at);
        if (!(at > shown)) return;
        const next = liveFigures(context, body);
        if (stopped || next === null) return;
        shown = at;
        setFigures(next);
      } catch {
        // Offline or refused: the figures on the page stand.
      }
    };
    void read();
    const timer = setInterval(() => void read(), LIVE_EVERY_MS);
    const onVisible = (): void => {
      if (document.visibilityState === "visible") void read();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [context]);
  return <Figures.Provider value={figures}>{children}</Figures.Provider>;
}

/** One figure's text: the live one once there is one, the page's own until then. */
export function Live({
  field,
  children,
}: {
  readonly field: LiveField;
  readonly children: ReactNode;
}) {
  const figures = useContext(Figures);
  const text = figures?.[field];
  return <>{text ?? children}</>;
}
