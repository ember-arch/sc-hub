import { repo, spectrumOn } from "./data";
import { type PatchNote, patchNotes } from "./patch-notes";
import {
  type Build,
  type Links,
  type Mention,
  type PatchComparison,
  builds,
  compareBuilds,
  latestLive,
  notesBetween,
  ptuInTesting,
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

/**
 * The PTU build CIG's latest PTU notes name, ahead of the newest LIVE patch; null when none, and
 * always null with the Spectrum module off, since the PTU notes are Spectrum posts.
 */
export function currentPtu(): {
  version: string;
  build: string | null;
  notes: PatchNote[];
} | null {
  const live = latestLive();
  const same = ptuInTesting(allPatchNotes(), live?.version ?? null);
  const newest = same[0];
  if (newest === undefined) return null;
  return { version: newest.version, build: newest.build, notes: same };
}

export interface PatchPageData {
  readonly comparison: PatchComparison;
  readonly notes: readonly PatchNote[];
  readonly mentions: ReadonlyMap<string, readonly Mention[]>;
  readonly totals: ReturnType<typeof totals>;
  readonly history: readonly Build[];
  /** Whether CIG's Spectrum posts can show (ADR-027); off, only RSI's notes are listed. */
  readonly spectrum: boolean;
}

export function patchPageData(from: Build, to: Build): PatchPageData | null {
  const comparison = compareBuilds(from, to, siteLinks());
  if (comparison === null) return null;
  // A hotfix against its own patch: the LIVE posts for that version (Hotfix Central, the
  // release notes); otherwise every post for the versions after the older build up to the newer.
  const notes =
    from.version === to.version
      ? allPatchNotes().filter(
          (n) => n.version === to.version && n.channel === "LIVE",
        )
      : notesBetween(allPatchNotes(), from.version, to.version);
  // Editions share their base's name (ADR-022); a note line names the ship, not every copy.
  const editions = new Set(
    repo()
      .ships.filter((s) => s.editionOf !== null)
      .map((s) => s.vehicle.class_name),
  );
  const ships = [
    ...comparison.ships.changed,
    ...comparison.ships.added,
    ...comparison.ships.removed,
  ]
    .filter((s) => !editions.has(s.id))
    .map((s) => ({ id: s.id, name: s.name, gameName: s.gameName }));
  return {
    comparison,
    notes,
    mentions: shipMentions(notes, ships),
    totals: totals(comparison),
    history: [...builds()].reverse(),
    spectrum: spectrumOn(),
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
