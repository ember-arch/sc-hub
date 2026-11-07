import type { Manufacturer } from "schema";
import { OFFICIAL_SITE_URL, SITE_NAME } from "ui/brand";
import type { ShipView } from "./data";

/**
 * SEO helpers (spec 02, "SEO"): the site's public origin, canonical URLs and the JSON-LD for
 * ships and manufacturers. Pure apart from reading the environment once.
 *
 * The origin comes from SITE_URL (CLAUDE.md section 9); when it is unset, a Vercel deployment
 * uses the production URL Vercel injects, and anything else uses the local dev origin. The
 * domain is undecided until the project name is (CLAUDE.md section 12), so no value is baked in.
 */
export function siteUrl(): URL {
  const configured = process.env["SITE_URL"];
  if (configured !== undefined && configured !== "") return new URL(configured);
  const vercel = process.env["VERCEL_PROJECT_PRODUCTION_URL"];
  if (vercel !== undefined && vercel !== "")
    return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}

/** An absolute URL for a site path. */
export function absolute(path: string): string {
  return new URL(path, siteUrl()).toString();
}

export type JsonLd = Readonly<Record<string, unknown>>;

/**
 * A ship as schema.org/Vehicle: name, page, manufacturer and the facts the pack has. Game
 * numbers are passed through, never typed in; anything the pack lacks is left out.
 */
export function shipJsonLd(ship: ShipView, description: string): JsonLd {
  const s = ship.stats;
  const maker = ship.manufacturer;
  const quantity = (value: number, unitCode: string) => ({
    "@type": "QuantitativeValue",
    value,
    unitCode,
  });
  return {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: ship.vehicle.name,
    url: absolute(`/ships/${ship.vehicle.slug}`),
    description,
    ...(maker === null
      ? {}
      : {
          manufacturer: {
            "@type": "Organization",
            name: maker.name,
            url: absolute(`/manufacturers/${maker.slug}`),
          },
        }),
    ...(ship.vehicle.role === null ? {} : { category: ship.vehicle.role }),
    ...(s === null
      ? {}
      : {
          weight: quantity(s.mass_kg, "KGM"),
          ...(s.cargo_scu === null
            ? {}
            : { cargoVolume: quantity(s.cargo_scu, "SCU") }),
          vehicleSeatingCapacity: s.crew_max,
        }),
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: SITE_NAME, url: absolute("/") },
  };
}

/** A manufacturer as schema.org/Organization; the description only when the pack has one. */
export function manufacturerJsonLd(m: Manufacturer): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: m.name,
    url: absolute(`/manufacturers/${m.slug}`),
    ...(m.description === "" ? {} : { description: m.description }),
    // Fictional organizations are described by the fan site; the official site is the source.
    sameAs: OFFICIAL_SITE_URL,
  };
}

/** Serialized for a `<script type="application/ld+json">`; `<` is escaped so the block cannot close itself. */
export function jsonLdHtml(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
