import NextLink from "next/link";
import { Badge, type BadgeTone } from "ui";
import type { Picture } from "../lib/showcase";
import { FramedArt } from "./ships/[slug]/showcase/dossier";

/**
 * The dossier index (ADR-011): the home page as a register of files. Featured files for the
 * concept hero and the live example, then every ship on record as a row.
 */

export interface FileFact {
  readonly label: string;
  readonly value: string;
  readonly unit?: string | undefined;
}

export function FeaturedFile({
  file,
  name,
  href,
  kicker,
  status,
  tagline,
  background,
  cutout,
  facts,
  priority,
}: {
  readonly file: string;
  readonly name: string;
  readonly href: string;
  readonly kicker: string;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly tagline: string | null;
  readonly background: Picture | null;
  readonly cutout: Picture | null;
  readonly facts: readonly FileFact[];
  readonly priority: boolean;
}) {
  return (
    <article
      aria-labelledby={`file-${file}`}
      className="flex flex-col gap-4 rounded-card border border-hairline bg-surface p-4"
    >
      <div className="flex items-center justify-between gap-3 text-caption">
        <span className="font-mono text-secondary">
          File <span className="text-primary">{file}</span>
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {background === null ? null : (
        <NextLink
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="block"
        >
          <FramedArt
            background={background}
            cutout={cutout}
            sizes="(min-width: 768px) 45vw, 100vw"
            priority={priority}
          />
        </NextLink>
      )}
      <div className="flex flex-col gap-1">
        <p className="m-0 text-caption text-secondary">{kicker}</p>
        <h2 id={`file-${file}`} className="m-0 text-title text-primary">
          <NextLink
            href={href}
            className="text-primary no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            {name}
          </NextLink>
        </h2>
        {tagline === null ? null : (
          <p className="m-0 text-ui text-secondary">{tagline}</p>
        )}
      </div>
      <dl className="m-0 mt-auto grid grid-cols-3 gap-2 border-t border-hairline pt-3">
        {facts.map((f) => (
          <div key={f.label} className="flex flex-col">
            <dt className="text-caption text-secondary">{f.label}</dt>
            <dd className="m-0 font-mono text-ui text-primary">
              {f.value}
              {f.unit === undefined ? null : (
                <span className="font-sans text-caption text-secondary">
                  {" "}
                  {f.unit}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <NextLink
        href={href}
        className="self-start rounded-control border border-hairline-strong px-3 py-1 text-ui text-primary no-underline transition-colors duration-hover hover:border-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        Open dossier
      </NextLink>
    </article>
  );
}

export interface RegisterRow {
  readonly file: string;
  readonly name: string;
  readonly href: string;
  readonly maker: string;
  readonly role: string | null;
  readonly status: { readonly tone: BadgeTone; readonly label: string };
  readonly length: string | null;
  readonly crew: string | null;
  /** The headline pledge price in US dollars (ADR-013), or null when none is on file. */
  readonly pledge: { readonly price: string; readonly onSale: boolean } | null;
  readonly thumb: { readonly src: string; readonly srcSet: string } | null;
}

/** Every file on record. On phones the maker, role and length columns step aside. */
export function Register({ rows }: { readonly rows: readonly RegisterRow[] }) {
  const th = "py-2 pr-4 text-left text-caption font-regular text-secondary";
  const td = "py-2 pr-4 align-middle";
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">Ship files on record</caption>
      <thead>
        <tr className="border-b border-hairline-strong">
          <th scope="col" className={`${th} w-16 sm:w-24`}>
            <span className="sr-only">Image</span>
          </th>
          <th scope="col" className={`${th} hidden sm:table-cell`}>
            File
          </th>
          <th scope="col" className={th}>
            Ship
          </th>
          <th scope="col" className={`${th} hidden md:table-cell`}>
            Maker
          </th>
          <th scope="col" className={`${th} hidden lg:table-cell`}>
            Role
          </th>
          <th scope="col" className={th}>
            Status
          </th>
          <th scope="col" className={`${th} hidden text-right md:table-cell`}>
            Length (m)
          </th>
          <th scope="col" className={`${th} text-right`}>
            Crew
          </th>
          <th scope="col" className={`${th} hidden text-right sm:table-cell`}>
            Pledge (USD)
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.file} className="border-b border-hairline">
            <td className={td}>
              {row.thumb === null ? (
                <div className="aspect-video w-16 rounded-control bg-inset sm:w-24" />
              ) : (
                <img
                  src={row.thumb.src}
                  srcSet={row.thumb.srcSet}
                  sizes="96px"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={96}
                  height={54}
                  className="block aspect-video w-16 rounded-control object-cover sm:w-24"
                />
              )}
            </td>
            <td
              className={`${td} hidden whitespace-nowrap font-mono text-caption text-secondary sm:table-cell`}
            >
              {row.file}
            </td>
            <td className={td}>
              <NextLink
                href={row.href}
                className="text-ui font-medium text-primary no-underline hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {row.name}
              </NextLink>
              <span className="block font-mono text-caption text-secondary sm:hidden">
                {row.file}
              </span>
            </td>
            <td className={`${td} hidden text-ui text-secondary md:table-cell`}>
              {row.maker}
            </td>
            <td className={`${td} hidden text-ui text-secondary lg:table-cell`}>
              {row.role ?? "Not stated"}
            </td>
            <td className={`${td} whitespace-nowrap`}>
              <Badge tone={row.status.tone}>{row.status.label}</Badge>
            </td>
            <td
              className={`${td} hidden text-right font-mono text-ui text-primary md:table-cell`}
            >
              {row.length ?? "—"}
            </td>
            <td
              className={`${td} whitespace-nowrap text-right font-mono text-ui text-primary`}
            >
              {row.crew ?? "—"}
            </td>
            <td
              className={`${td} hidden whitespace-nowrap text-right font-mono text-ui text-primary sm:table-cell`}
            >
              {row.pledge === null ? "—" : row.pledge.price}
              {row.pledge === null || row.pledge.onSale ? null : (
                <span className="block font-sans text-caption text-secondary">
                  Not on sale
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
