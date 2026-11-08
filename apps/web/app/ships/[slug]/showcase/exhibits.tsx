import type { Picture } from "../../../../lib/showcase";

/** Dossier exhibits (ADR-011): numbered figures in a contact-sheet grid; each opens full size. */
export function Exhibits({
  section,
  pictures,
}: {
  readonly section: number;
  readonly pictures: readonly Picture[];
}) {
  const largest = (p: Picture): string =>
    p.srcSet.split(", ")[0]?.split(" ")[0] ?? p.src;
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {pictures.map((p, i) => (
        <li key={p.src}>
          <figure className="m-0 flex flex-col gap-2">
            <a
              href={largest(p)}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-card border border-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <img
                src={p.src}
                srcSet={p.srcSet}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 100vw"
                width={p.width}
                height={p.height}
                alt={p.alt}
                loading="lazy"
                decoding="async"
                className="block aspect-video h-auto w-full object-cover"
              />
            </a>
            <figcaption className="text-caption text-secondary">
              <span className="font-mono text-primary">
                Fig. {section}.{i + 1}
              </span>{" "}
              Exhibit, opens full size
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

/** CIG's schematics, each with its phone version where CIG made one. */
export function Schematics({
  section,
  schematics,
}: {
  readonly section: number;
  readonly schematics: readonly {
    readonly wide: Picture;
    readonly narrow: Picture | null;
    readonly caption: string;
  }[];
}) {
  return (
    <div className="flex flex-col gap-8">
      {schematics.map((s, i) => (
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
              sizes="(min-width: 1024px) 75vw, 100vw"
              width={s.wide.width}
              height={s.wide.height}
              alt={s.wide.alt}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full rounded-card border border-hairline"
            />
          </picture>
          <figcaption className="text-caption text-secondary">
            <span className="font-mono text-primary">
              Fig. {section}.{i + 1}
            </span>{" "}
            {s.caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
