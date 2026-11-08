import type { ChapterView } from "../../../../lib/showcase";
import { AutoVideo } from "./auto-video";

/**
 * The ship's story in CIG's words (ADR-010): each chapter of its Comm-Link as a full-bleed render
 * or render loop, then the chapter's kicker, heading and text in an editorial grid that alternates
 * sides. Text is the article's, verbatim; headings are set in sentence case.
 */
export function Chapters({
  chapters,
  name,
}: {
  readonly chapters: readonly ChapterView[];
  readonly name: string;
}) {
  if (chapters.length === 0) return null;
  return (
    <div className="flex flex-col">
      {chapters.map((chapter, index) => {
        const flip = index % 2 === 1;
        return (
          <article
            key={chapter.heading}
            aria-labelledby={`chapter-${index}`}
            className="flex flex-col"
          >
            {chapter.video !== null ? (
              <AutoVideo
                src={chapter.video.src}
                poster={chapter.video.poster ?? chapter.image?.src ?? null}
                label={`${name}: ${chapter.kicker ?? chapter.heading}, render loop`}
              />
            ) : chapter.image !== null ? (
              <picture>
                <img
                  src={chapter.image.src}
                  srcSet={chapter.image.srcSet}
                  sizes="100vw"
                  width={chapter.image.width}
                  height={chapter.image.height}
                  alt={chapter.image.alt}
                  loading="lazy"
                  decoding="async"
                  className="block aspect-video h-auto max-h-[90svh] w-full object-cover"
                />
              </picture>
            ) : null}
            <div className="mx-auto grid w-full max-w-content gap-6 px-4 py-16 md:grid-cols-12 md:py-24">
              <header
                className={`flex flex-col gap-3 md:col-span-5 ${flip ? "md:col-start-8 md:row-start-1" : ""}`}
              >
                <p className="m-0 flex items-baseline gap-3 text-ui text-secondary">
                  <span className="font-mono text-accent">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {chapter.kicker}
                </p>
                <h2
                  id={`chapter-${index}`}
                  className="m-0 text-display text-primary"
                >
                  {chapter.heading}
                </h2>
              </header>
              <div
                className={`flex flex-col gap-4 md:col-span-6 ${flip ? "md:col-start-1 md:row-start-1" : "md:col-start-7"}`}
              >
                {chapter.text.map((p) => (
                  <p
                    key={p.slice(0, 40)}
                    className="m-0 text-heading font-regular text-secondary"
                  >
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
