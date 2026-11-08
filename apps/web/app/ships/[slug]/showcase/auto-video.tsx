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
 * its own; the poster shows with the browser's controls.
 */
export function AutoVideo({
  src,
  poster,
  label,
}: {
  readonly src: string;
  readonly poster: string | null;
  readonly label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
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
    if (video === null || !near || reduced) return;
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
  }, [near, reduced]);

  return (
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
      className="block aspect-video h-auto max-h-[90svh] w-full bg-page object-cover"
    />
  );
}
