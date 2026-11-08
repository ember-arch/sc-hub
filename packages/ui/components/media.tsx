/**
 * Image shapes the components take (ADR-009). The site builds these from its media manifest;
 * components never read files. Images are drawn as they come: no overlays, tints or filters
 * (fankit guidelines, section 3), and always with their width and height so nothing shifts.
 */

export interface ImageFile {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

export interface ResponsiveImage extends ImageFile {
  /** Every rendition, for example "/media/a-1920.webp 1920w, /media/a-640.webp 640w". */
  readonly srcSet: string;
  /** Empty when the image only repeats nearby text (a card's ship name). */
  readonly alt: string;
  /** Where the image came from, shown under it: "Image: Roberts Space Industries". */
  readonly credit: { readonly text: string; readonly href: string };
}

/** A maker's logo in its two official versions; null when the fankit has no light version. */
export interface MakerMark {
  readonly alt: string;
  readonly onLight: ImageFile;
  readonly onDark: ImageFile | null;
}

export interface MarkProps {
  readonly mark: MakerMark;
  /** Height class from the spacing scale, for example "h-10". */
  readonly heightClass: string;
}

/**
 * Shows the dark mark on light pages and the light mark on dark pages. Which one shows follows the
 * page theme (`data-theme`, or the system setting) through the `theme-on-light` and
 * `theme-on-dark` rules in the app's global CSS, so it never flashes the wrong one. A maker
 * without a light mark shows nothing on dark pages rather than a recolored logo. Both load lazily:
 * the hidden one is never fetched, and React adds no preload hint that prefetching would spread to
 * every page linking here.
 */
export function Mark({ mark, heightClass }: MarkProps) {
  return (
    <>
      <img
        src={mark.onLight.src}
        width={mark.onLight.width}
        height={mark.onLight.height}
        alt={mark.alt}
        loading="lazy"
        decoding="async"
        className={`theme-on-light w-auto self-start ${heightClass}`}
      />
      {mark.onDark === null ? null : (
        <img
          src={mark.onDark.src}
          width={mark.onDark.width}
          height={mark.onDark.height}
          alt={mark.alt}
          loading="lazy"
          decoding="async"
          className={`theme-on-dark w-auto self-start ${heightClass}`}
        />
      )}
    </>
  );
}
