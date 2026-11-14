import type { ConceptShip, EventRecord } from "schema";
import { type Repository, spectrumOn } from "./data";
import { hullResolver, hullsOn, leadDay, shipResolver } from "./events";
import {
  type NamedShip,
  type NewsMention,
  type ReleaseInput,
  type ShowInput,
  makerWords,
  newShips,
  shipsNamedIn,
} from "./featured";
import { latestLive, previousOf, snapshotOf } from "./patches";

/**
 * What the featured ships read from the pack (ADR-060): the show's day, the newest LIVE patch's
 * new ships, and the ships CIG names in its titles. `featured.ts` decides from these.
 */

/**
 * The show's day as the featured rule reads it: the day the front page's hero leads with (the one
 * on now, or the first before the doors open), its ships in RSI's order (the one its banner names
 * first, as on the hero) and the limited hulls
 * whose waves start on it (with the Spectrum module on, as on the hero). A day without a list
 * (Best in Show) takes the whole show's ships. Null outside a show, or when no ship resolves.
 */
export function showInput(
  event: EventRecord | null,
  at: Date,
  r: Pick<Repository, "entries" | "manufacturers">,
  concepts?: readonly ConceptShip[],
): ShowInput | null {
  if (event === null) return null;
  const day = leadDay(event, at);
  if (day === null) return null;
  const resolve = shipResolver(r, concepts);
  const pool =
    day.ships.length > 0 ? day.ships : event.days.flatMap((d) => d.ships);
  // The ship RSI's banner for the day names leads, as on the hero (`dayBanner`).
  const featured =
    day.featured === null
      ? undefined
      : pool.find((s) => s.name === day.featured);
  const listed =
    featured === undefined
      ? pool
      : [featured, ...pool.filter((s) => s !== featured)];
  const slugs = listed
    .map((ship) => resolve(ship).slug)
    .filter((s): s is string => s !== null);
  if (slugs.length === 0) return null;
  const sales = spectrumOn() ? event.sales : null;
  const hull = hullResolver(resolve);
  const limited = hullsOn(sales, day)
    .map((h) => hull(h.name).slug)
    .filter((s): s is string => s !== null);
  return { slugs, limited };
}

/**
 * The newest LIVE patch's new ships, as register entries: the records that brought a name to the
 * build (`newShips`), an edition read as its entry. Null without two LIVE builds on file or a
 * release date.
 */
export function releaseInput(
  r: Pick<Repository, "ships">,
): ReleaseInput | null {
  const to = latestLive();
  const from = to === null ? null : previousOf(to);
  if (to === null || from === null || to.releasedAt === null) return null;
  const before = snapshotOf(from.code);
  const after = snapshotOf(to.code);
  if (before === null || after === null) return null;
  const byClass = new Map(r.ships.map((s) => [s.vehicle.class_name, s]));
  const slugs = newShips(before.ships, after.ships).flatMap((id) => {
    const ship = byClass.get(id);
    if (ship === undefined) return [];
    return [ship.editionOf?.slug ?? ship.vehicle.slug];
  });
  return {
    version: to.version,
    releasedAt: to.releasedAt,
    slugs: [...new Set(slugs)],
  };
}

/** The ships a title can name: every entry and concept ship, with the words its maker goes by. */
export function nameableShips(
  r: Pick<Repository, "entries" | "manufacturers">,
  concepts: readonly ConceptShip[],
): NamedShip[] {
  const makerName = new Map(r.manufacturers.map((m) => [m.code, m.name]));
  return [
    ...r.entries.map((s) => ({
      slug: s.vehicle.slug,
      name: s.vehicle.name,
      makers: makerWords(
        s.vehicle.manufacturer_code,
        makerName.get(s.vehicle.manufacturer_code) ?? null,
      ),
    })),
    ...concepts.map((c) => ({
      slug: c.slug,
      name: c.name,
      makers: makerWords(
        c.manufacturer_code,
        makerName.get(c.manufacturer_code) ?? null,
      ),
    })),
  ];
}

/**
 * The ships CIG names in the titles of its Comm-Links and videos ("RSI Galaxy - Mission Made",
 * "Behind the Ships: RSI Galaxy"), each with the post's time. Titles only: a summary's passing
 * mention is not a feature.
 */
export function newsMentions(
  r: Pick<Repository, "entries" | "manufacturers" | "dispatches" | "videos">,
  concepts: readonly ConceptShip[],
): NewsMention[] {
  const ships = nameableShips(r, concepts);
  const posts = [
    ...r.dispatches.filter((d) => d.source === "comm_link"),
    ...r.videos,
  ];
  return posts.flatMap((post) =>
    shipsNamedIn(post.title, ships).map((slug) => ({
      slug,
      published_at: post.published_at,
    })),
  );
}
