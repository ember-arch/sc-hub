"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const REDUCED = "(prefers-reduced-motion: reduce)";

/** The reader's reduced-motion setting, live; false on the server so the markup matches. */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED).matches,
    () => false,
  );
}

/**
 * CIG's render loops (ADR-010): muted, looping, playing only while most of it is on screen and
 * paused otherwise, fetched only as it approaches. With reduced motion asked for it never plays on
 * its own; the poster shows with the browser's controls. A loop with a known size shows whole at
 * its own proportions (ADR-015): CIG's wide loops are never cropped to 16:9. A Pause button stops
 * a loop for good (WCAG 2.2.2: moving content can be paused); Play starts it again.
 */
export function AutoVideo({
  src,
  poster,
  label,
  width = null,
  height = null,
}: {
  readonly src: string;
  readonly poster: string | null;
  readonly label: string;
  readonly width?: number | null;
  readonly height?: number | null;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [stopped, setStopped] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (video === null) return;
    const approach = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          setNear(true);
          approach.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    approach.observe(video);
    return () => approach.disconnect();
  }, []);

  useEffect(() => {
    const video = ref.current;
    if (video === null || !near || reduced || stopped) return;
    const visible = new IntersectionObserver(
      ([entry]) => {
        if (entry === undefined) return;
        if (entry.intersectionRatio >= 0.4)
          void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: [0, 0.4, 0.8] },
    );
    visible.observe(video);
    return () => visible.disconnect();
  }, [near, reduced, stopped]);

  return (
    <div className="relative">
      <video
        ref={ref}
        src={near ? src : undefined}
        poster={poster ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        controls={reduced}
        aria-label={label}
        width={width ?? undefined}
        height={height ?? undefined}
        className={
          width === null || height === null
            ? "block aspect-video h-auto max-h-[90svh] w-full bg-page object-cover"
            : "block h-auto max-h-[90svh] w-full bg-page object-contain"
        }
      />
      {reduced ? null : (
        <button
          type="button"
          aria-pressed={stopped}
          onClick={() => {
            const video = ref.current;
            if (video === null) return;
            if (stopped) {
              setStopped(false);
              void video.play().catch(() => undefined);
            } else {
              setStopped(true);
              video.pause();
            }
          }}
          className="absolute bottom-2 right-2 rounded-control border border-hairline-strong bg-page px-2 py-1 text-caption text-primary hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        >
          {stopped ? "Play" : "Pause"}
          <span className="sr-only"> {label}</span>
        </button>
      )}
    </div>
  );
}
