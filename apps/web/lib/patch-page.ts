import { repo } from "./data";
import { type PatchNote, patchNotes } from "./patch-notes";
import {
  type Build,
  type Links,
  type Mention,
  type PatchComparison,
  builds,
  compareBuilds,
  compareVersions,
  latestLive,
  notesBetween,
  previousOf,
  shipMentions,
  totals,
} from "./patches";

/**
 * What a patch page needs, put together from the snapshots, the pack and the news pack
 * (ADR-049). The pages stay thin: each route picks the two builds and renders `PatchView`.
 */

let links: Links | undefined;

/** Ships and parts link to their pages when the current pack lists them. */
export function siteLinks(): Links {
  if (links !== undefined) return links;
  const r = repo();
  const ships = new Map(
    r.ships.map((s) => [s.vehicle.class_name, `/ships/${s.vehicle.slug}`]),
  );
  const parts = new Map(
    r.components.map((c) => [
      c.item.class_name.toLowerCase(),
      {
        className: c.item.class_name,
        name: c.item.name,
        href: `/components/${c.item.slug}`,
      },
    ]),
  );
  const makers = new Map(r.manufacturers.map((m) => [m.code, m.name]));
  links = {
    maker: (code) => makers.get(code) ?? null,
    ship: (cls) => ships.get(cls) ?? null,
    // Blueprints name their output in lower case; the pack keeps the game's case.
    part: (cls) => parts.get(cls.toLowerCase()) ?? null,
  };
  return links;
}

let notes: PatchNote[] | undefined;

export function allPatchNotes(): PatchNote[] {
  notes ??= patchNotes(repo().news);
  return notes;
}

/** The PTU build CIG's latest PTU notes name, ahead of the newest LIVE patch; null when none. */
export function currentPtu(): {
  version: string;
  build: string | null;
  notes: PatchNote[];
} | null {
  const live = latestLive();
  const ptu = allPatchNotes().filter(
    (n) =>
      n.channel === "PTU" &&
      (live === null || compareVersions(n.version, live.version) > 0),
  );
  const newest = ptu[0];
  if (newest === undefined) return null;
  // Only the version the newest PTU post is for: an older PTU line has gone LIVE or been dropped.
  const same = ptu.filter((n) => n.version === newest.version);
  return { version: newest.version, build: newest.build, notes: same };
}

export interface PatchPageData {
  readonly comparison: PatchComparison;
  readonly notes: readonly PatchNote[];
  readonly mentions: ReadonlyMap<string, readonly Mention[]>;
  readonly totals: ReturnType<typeof totals>;
  readonly history: readonly Build[];
}

export function patchPageData(from: Build, to: Build): PatchPageData | null {
  const comparison = compareBuilds(from, to, siteLinks());
  if (comparison === null) return null;
  const notes = notesBetween(allPatchNotes(), from.version, to.version);
  const ships = [
    ...comparison.ships.changed,
    ...comparison.ships.added,
    ...comparison.ships.removed,
  ].map((s) => ({ id: s.id, name: s.name, gameName: s.gameName }));
  return {
    comparison,
    notes,
    mentions: shipMentions(notes, ships),
    totals: totals(comparison),
    history: [...builds()].reverse(),
  };
}

/** A build and the LIVE build before it, by the page's address segment. */
export function pairFor(slug: string): { from: Build; to: Build } | null {
  const list = builds();
  const to = list.find((b) => b.slug === slug);
  if (to === undefined) return null;
  const from = previousOf(to, list);
  return from === null ? null : { from, to };
}
