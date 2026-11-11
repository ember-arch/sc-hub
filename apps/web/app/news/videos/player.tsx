"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, TextLink } from "ui";

interface Playing {
  readonly embed: string;
  readonly title: string;
  readonly url: string;
  readonly short: boolean;
}

/**
 * The page's video player (ADR-050): one native modal `dialog` over a dimmed page, opened when a
 * reader presses a `VideoCard`'s thumbnail or title. It listens on the document, so the cards stay
 * server-rendered links to YouTube: without script, or with a modifier key or a middle click, they
 * go to YouTube as links do. The player is YouTube's privacy-enhanced embed, loaded only now, on
 * the reader's own press, and unloaded on close so playback stops. Escape, the close button and a
 * press on the dimmed page close it; focus goes back to the card. "Watch on YouTube" in the
 * player and on every card is the source link (obligations.md).
 */
export function VideoPlayer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [playing, setPlaying] = useState<Playing | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (anchor === null || anchor.closest("[data-video-out]") !== null)
        return;
      const card = anchor.closest<HTMLElement>("[data-video-embed]");
      if (card === null) return;
      const embed = card.dataset["videoEmbed"];
      const title = card.dataset["videoTitle"];
      if (embed === undefined || title === undefined) return;
      event.preventDefault();
      trigger.current =
        card.querySelector<HTMLElement>("h3 a") ?? (anchor as HTMLElement);
      setPlaying({
        embed,
        title,
        url: anchor.href,
        short: card.dataset["videoShort"] === "true",
      });
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const el = dialog.current;
    if (el === null) return;
    if (playing !== null && !el.open) el.showModal();
  }, [playing]);

  const close = () => {
    dialog.current?.close();
  };

  return (
    <dialog
      ref={dialog}
      aria-label={playing === null ? "Video" : playing.title}
      onClose={() => {
        setPlaying(null);
        trigger.current?.focus();
      }}
      onClick={(event) => {
        // A press on the dimmed page around the player, not on the player itself.
        if (event.target === dialog.current) close();
      }}
      className={`m-auto max-h-full overflow-visible rounded-card bg-surface p-0 text-primary shadow-lift backdrop:bg-page/80 ${playing?.short === true ? "w-auto" : "w-full max-w-content"}`}
    >
      {playing === null ? null : (
        <div className="flex flex-col gap-3 p-3 md:p-4">
          <div className="flex items-start justify-between gap-4">
            <p className="m-0 text-ui font-medium text-primary">
              {playing.title}
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="Close the video"
              className="flex shrink-0 items-center gap-1 rounded-pill px-3 py-1 text-ui text-secondary transition-colors duration-hover hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              autoFocus
            >
              <Icon name="close" />
              Close
            </button>
          </div>
          <iframe
            src={playing.embed}
            title={playing.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            className={`block rounded-control border-0 bg-inset ${playing.short ? "mx-auto aspect-[9/16] h-[80svh] max-w-full" : "aspect-video max-h-[80svh] w-full"}`}
          />
          <p className="m-0 text-caption">
            <TextLink href={playing.url} external>
              Watch on YouTube
            </TextLink>
          </p>
        </div>
      )}
    </dialog>
  );
}
