import { TextLink } from "ui";
import { SHOWCASE_CREDITS, type ShowcaseView } from "../../../../lib/showcase";
import { Chapters } from "./chapters";
import { ModelStage } from "./model-stage";

/**
 * Everything a showcase adds under the hero (ADR-010): the story chapters, the 3D model, CIG's
 * schematics, a gallery, and where each piece came from. Full-bleed, so it lives in the page's
 * stage slot above the reference data.
 */
export function ShowcaseSections({
  show,
  name,
  length,
}: {
  readonly show: ShowcaseView;
  readonly name: string;
  readonly length: number | null;
}) {
  const largest = (srcSet: string): string =>
    srcSet.split(", ")[0]?.split(" ")[0] ?? "";
  return (
    <>
      <Chapters chapters={show.chapters} name={name} />

      {show.model === null ? null : (
        <ModelStage
          src={show.model.src}
          bytes={show.model.bytes}
          name={name}
          length={length}
          poster={show.poster?.src ?? null}
          credit={SHOWCASE_CREDITS.model}
        />
      )}

      {show.schematics.length === 0 ? null : (
        <section
          aria-labelledby="schematics"
          className="flex flex-col gap-8 py-16"
        >
          <div className="mx-auto w-full max-w-content px-4">
            <h2 id="schematics" className="m-0 text-display text-primary">
              Schematics
            </h2>
          </div>
          {show.schematics.map((s) => (
            <figure key={s.caption} className="m-0 flex flex-col gap-2">
              <picture>
                {s.narrow === null ? null : (
                  <source
                    media="(max-width: 767px)"
                    srcSet={s.narrow.srcSet}
                    sizes="100vw"
                  />
                )}
                <img
                  src={s.wide.src}
                  srcSet={s.wide.srcSet}
                  sizes="100vw"
                  width={s.wide.width}
                  height={s.wide.height}
                  alt={s.wide.alt}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              </picture>
              <figcaption className="mx-auto w-full max-w-content px-4 text-caption text-secondary">
                {s.caption}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      {show.gallery.length === 0 ? null : (
        <section aria-labelledby="gallery" className="py-16">
          <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4">
            <h2 id="gallery" className="m-0 text-display text-primary">
              Gallery
            </h2>
            <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-3">
              {show.gallery.map((p, i) => (
                <li
                  key={p.src}
                  className={
                    i === 0 ? "md:col-span-2 md:row-span-2" : undefined
                  }
                >
                  <a
                    href={largest(p.srcSet)}
                    target="_blank"
                    rel="noreferrer"
                    className="group block overflow-hidden rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <img
                      src={p.src}
                      srcSet={p.srcSet}
                      sizes={
                        i === 0
                          ? "(min-width: 768px) 66vw, 100vw"
                          : "(min-width: 768px) 33vw, 100vw"
                      }
                      width={p.width}
                      height={p.height}
                      alt={p.alt}
                      loading="lazy"
                      decoding="async"
                      className="block h-full w-full object-cover transition-transform duration-hover group-hover:scale-[1.02]"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section aria-label="Sources" className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-content flex-col gap-2 px-4 py-8 text-caption text-secondary">
          {show.article === null ? null : (
            <p className="m-0">
              Art, render loops and story:{" "}
              <TextLink
                href={show.article.url}
                external
                className="text-secondary"
              >
                Roberts Space Industries, Comm-Link &ldquo;{show.article.title}
                &rdquo;
              </TextLink>
              , published {show.article.published_at.slice(0, 10)}. Text quoted
              verbatim; headings in sentence case.
            </p>
          )}
          {show.model === null ? null : (
            <p className="m-0">
              <TextLink
                href={SHOWCASE_CREDITS.model.href}
                external
                className="text-secondary"
              >
                {SHOWCASE_CREDITS.model.text}
              </TextLink>
              .
            </p>
          )}
        </div>
      </section>
    </>
  );
}
