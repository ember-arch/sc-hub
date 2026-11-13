import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  type Channel,
  type PatchFigures,
  type PatchIngredient,
  type PatchShip,
  type PatchSnapshot,
  PatchSnapshotFile,
  type PatchValue,
  decodeSnapshot,
} from "schema";
import { REPO_ROOT } from "./data";
import { placeOf } from "./loadout-editor";
import {
  type FigureLabel,
  PART_FAMILIES,
  PART_GROUPS,
  SHIP_GROUPS,
  blueprintFigureLabel,
  humanize,
  partFigureLabel,
  shipFigureLabel,
} from "./patch-labels";
import type { PatchNote } from "./patch-notes";

/**
 * What changed between two builds (ADR-049): every ship, part and blueprint the two snapshots in
 * `fixtures/patches/` hold, compared figure by figure as the source states them. Nothing is
 * inferred: a figure shows as changed only when both builds state it and the values differ, as
 * added or removed only when the other build states that figure for some entry of the same kind
 * (otherwise the source simply did not record it then, and it is counted, not shown).
 */

export const PATCHES_DIR = join(REPO_ROOT, "fixtures", "patches");

export interface Build {
  /** The full build string: `4.10.2-LIVE.12881860`. */
  readonly code: string;
  /** `4.10.2`. */
  readonly version: string;
  readonly number: string;
  readonly channel: Channel;
  /** The page's address segment: the version, or version and build number when two share it. */
  readonly slug: string;
  readonly releasedAt: string | null;
  readonly counts: PatchSnapshot["counts"];
}

const CODE = /^(\d+\.\d+\.\d+)-(LIVE|PTU|EPTU)\.(\d+)$/i;

export function parseCode(
  code: string,
): { version: string; channel: Channel; number: string } | null {
  const m = CODE.exec(code.trim());
  if (m === null) return null;
  return {
    version: m[1]!,
    channel: m[2]!.toUpperCase() as Channel,
    number: m[3]!,
  };
}

/** Orders versions as numbers: 4.9.0 before 4.10.0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * The PTU posts for the version in testing now, newest first, or empty (ADR-049, ADR-046): posts
 * for a version ahead of LIVE, leaving out a version CIG has marked closed on any of its posts
 * ("[Now Closed] ...", a tech preview that ended) and every version CIG has already put out on
 * LIVE: its LIVE release notes, official notes or hotfix posts are on the pack, while the wiki's
 * build may lag a day. A Comm-Link announcement does not count as a release: a preview of a
 * version is announced before it reaches LIVE.
 * Only the version of the newest such post: an older PTU line has gone LIVE or been dropped.
 */
export function ptuInTesting(
  notes: readonly PatchNote[],
  liveVersion: string | null,
): PatchNote[] {
  const released = new Set(
    notes
      .filter((n) => n.channel === "LIVE" && n.kind !== "announcement")
      .map((n) => n.version),
  );
  const closed = new Set(
    notes
      .filter((n) => n.channel === "PTU" && /\bclosed\b/i.test(n.title))
      .map((n) => n.version),
  );
  const open = notes.filter(
    (n) =>
      n.channel === "PTU" &&
      !closed.has(n.version) &&
      !released.has(n.version) &&
      (liveVersion === null || compareVersions(n.version, liveVersion) > 0),
  );
  const newest = open[0];
  return newest === undefined
    ? []
    : open.filter((n) => n.version === newest.version);
}

/** A LIVE version CIG has released ahead of the newest build whose figures are on record. */
export interface ReleasedAhead {
  /** "4.10.3". */
  readonly version: string;
  /** The first of its release notes or official notes; a hotfix post's only when there are none. */
  readonly releasedAt: string;
  /** CIG's posts for the versions after the LIVE build on record up to this one, newest first. */
  readonly notes: PatchNote[];
}

/**
 * The newest version CIG has put out on LIVE ahead of the newest LIVE build on record (the
 * owner, 2026-11-12, when 4.10.3 went LIVE before the Star Citizen Wiki published its data:
 * "update it and all the corresponding patch info on the patch pages"). Released means CIG's LIVE
 * release notes, official notes or a hotfix post for it are on the pack, the same test
 * `ptuInTesting` uses; a Comm-Link announcement alone is not a release. Its figures follow when
 * the wiki publishes the build (ADR-023, ADR-049); until then the site names it and shows its
 * notes. Null when no such version, or no LIVE build is on record.
 */
export function releasedAhead(
  notes: readonly PatchNote[],
  liveVersion: string | null,
): ReleasedAhead | null {
  if (liveVersion === null) return null;
  const releases = notes.filter(
    (n) =>
      n.channel === "LIVE" &&
      n.kind !== "announcement" &&
      compareVersions(n.version, liveVersion) > 0,
  );
  const newest = releases
    .map((n) => n.version)
    .sort((a, b) => compareVersions(b, a))[0];
  if (newest === undefined) return null;
  // Dated by its release notes or official notes; a hotfix post only when there are none, since
  // Hotfix Central is one long-lived thread CIG renames each patch, published months before.
  const own = releases.filter((n) => n.version === newest);
  const dated = own.filter((n) => n.kind === "live" || n.kind === "official");
  const releasedAt = (dated.length > 0 ? dated : own)
    .map((n) => n.publishedAt)
    .sort()[0]!;
  return {
    version: newest,
    releasedAt,
    notes: notesBetween(notes, liveVersion, newest),
  };
}

/** The post a release's notes link first: its LIVE release notes, else RSI's official notes. */
export function releaseNotesOf(ahead: ReleasedAhead): PatchNote | null {
  const own = ahead.notes.filter(
    (n) => n.version === ahead.version && n.channel === "LIVE",
  );
  return (
    own.find((n) => n.kind === "live") ??
    own.find((n) => n.kind === "official") ??
    null
  );
}

let cached: { dir: string; snapshots: PatchSnapshot[] } | undefined;

/** Every snapshot on file, oldest first; empty when the folder is absent. */
export function snapshots(dir: string = PATCHES_DIR): readonly PatchSnapshot[] {
  if (cached !== undefined && cached.dir === dir) return cached.snapshots;
  const list = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json.gz") && /^\d/.test(f))
        .map((f) =>
          decodeSnapshot(
            PatchSnapshotFile.parse(
              JSON.parse(
                gunzipSync(readFileSync(join(dir, f))).toString("utf8"),
              ) as unknown,
            ),
          ),
        )
    : [];
  list.sort(byRelease);
  cached = { dir, snapshots: list };
  return list;
}

function byRelease(a: PatchSnapshot, b: PatchSnapshot): number {
  const ca = parseCode(a.game_version);
  const cb = parseCode(b.game_version);
  const v = compareVersions(ca?.version ?? "0", cb?.version ?? "0");
  if (v !== 0) return v;
  return Number(ca?.number ?? 0) - Number(cb?.number ?? 0);
}

/** The builds on file, oldest first, each with its page's address. */
export function buildsOf(list: readonly PatchSnapshot[]): Build[] {
  const builds = list.flatMap((s) => {
    const c = parseCode(s.game_version);
    return c === null
      ? []
      : [
          {
            code: s.game_version,
            version: c.version,
            number: c.number,
            channel: c.channel,
            releasedAt: s.released_at,
            counts: s.counts,
          },
        ];
  });
  // The first build of a version takes the plain address and keeps it; a later build of the same
  // version (a hotfix) adds its number. Builds only ever arrive newer, so no address moves
  // (CLAUDE.md section 5: an address never changes after first publish).
  return builds.map((b, i) => {
    const later = builds
      .slice(0, i)
      .some((o) => o.version === b.version && o.channel === b.channel);
    const base =
      b.channel === "LIVE"
        ? b.version
        : `${b.version}-${b.channel.toLowerCase()}`;
    return { ...b, slug: later ? `${base}-${b.number}` : base };
  });
}

export function builds(): Build[] {
  return buildsOf(snapshots());
}

export function snapshotOf(code: string): PatchSnapshot | null {
  return snapshots().find((s) => s.game_version === code) ?? null;
}

/**
 * How a comparison names a build: its version, and its build number too when the other build is
 * of the same version (a hotfix against its patch).
 */
export function buildLabel(b: Build, other: Build): string {
  return b.version === other.version ? `${b.version} (${b.number})` : b.version;
}

/** The build before this one on the same channel. */
export function previousOf(
  build: Build,
  list: readonly Build[] = builds(),
): Build | null {
  const same = list.filter((b) => b.channel === build.channel);
  const i = same.findIndex((b) => b.code === build.code);
  return i > 0 ? (same[i - 1] ?? null) : null;
}

/** The newest LIVE build on file. */
export function latestLive(list: readonly Build[] = builds()): Build | null {
  return list.filter((b) => b.channel === "LIVE").at(-1) ?? null;
}

// ---------------------------------------------------------------------------------------------

export interface FigureChange {
  readonly key: string;
  readonly label: string;
  readonly unit?: string | undefined;
  readonly group: string;
  readonly from: PatchValue | null;
  readonly to: PatchValue | null;
}

export interface PartRef {
  readonly className: string;
  readonly name: string;
  readonly href: string | null;
}

export interface LoadoutChange {
  readonly port: string;
  /** Where on the ship, in words, when the port's name says ("Left wing"). */
  readonly place: string | null;
  readonly from: PartRef | null;
  readonly to: PartRef | null;
}

export interface IngredientChange {
  readonly name: string;
  readonly from: PatchIngredient | null;
  readonly to: PatchIngredient | null;
}

export type EntryStatus = "added" | "removed" | "changed";

export interface EntryChange {
  /** Class name for ships and parts, the key for blueprints. */
  readonly id: string;
  readonly name: string;
  readonly status: EntryStatus;
  readonly href: string | null;
  /** A short line under the name: maker, size, grade, kind. */
  readonly detail: string | null;
  /** Changed figures; for an added or removed entry, its headline figures. */
  readonly figures: readonly FigureChange[];
  readonly loadout: readonly LoadoutChange[];
  readonly ingredients: readonly IngredientChange[];
  /** The name patch notes would use ("Aegis Gladius"), for matching mentions. */
  readonly gameName: string | null;
}

export interface ChangeSet {
  readonly added: readonly EntryChange[];
  readonly removed: readonly EntryChange[];
  readonly changed: readonly EntryChange[];
}

export interface FamilyChanges extends ChangeSet {
  readonly id: string;
  readonly label: string;
}

export interface PatchComparison {
  readonly from: Build;
  readonly to: Build;
  readonly ships: ChangeSet;
  readonly parts: readonly FamilyChanges[];
  readonly blueprints: ChangeSet;
  /** Figures one of the builds does not record for any entry of their kind, left out. */
  readonly unrecorded: number;
  /** Ships one build lists without figures (ADR-049), neither added nor removed. */
  readonly uncompared: number;
}

/** Where entries link to on this site; null for one the current pack does not list. */
export interface Links {
  ship(className: string): string | null;
  part(className: string): PartRef | null;
  /** A manufacturer's name by its code; null leaves the code. */
  maker(code: string): string | null;
}

export const NO_LINKS: Links = {
  ship: () => null,
  part: () => null,
  maker: () => null,
};

/** Every figure path any entry of a kind states. */
function statedKeys(records: Iterable<{ figures: PatchFigures }>): Set<string> {
  const keys = new Set<string>();
  for (const r of records) for (const k of Object.keys(r.figures)) keys.add(k);
  return keys;
}

function figureOrder(
  groups: readonly string[],
): (a: FigureChange, b: FigureChange) => number {
  return (a, b) => {
    const ga = groups.indexOf(a.group);
    const gb = groups.indexOf(b.group);
    if (ga !== gb) return (ga < 0 ? 99 : ga) - (gb < 0 ? 99 : gb);
    return a.label.localeCompare(b.label, "en");
  };
}

function figureChanges(
  from: PatchFigures,
  to: PatchFigures,
  fromStated: ReadonlySet<string>,
  toStated: ReadonlySet<string>,
  labelOf: (path: string) => FigureLabel,
  groups: readonly string[],
  unrecorded: { count: number },
): FigureChange[] {
  const out: FigureChange[] = [];
  const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
  for (const key of keys) {
    const a = from[key];
    const b = to[key];
    if (a === b) continue;
    // A "formatted" figure is a text twin of the number beside it ("1m 2s" for 62).
    if (key.endsWith(".formatted")) continue;
    if (a === undefined && !fromStated.has(key)) {
      unrecorded.count += 1;
      continue;
    }
    if (b === undefined && !toStated.has(key)) {
      unrecorded.count += 1;
      continue;
    }
    const l = labelOf(key);
    out.push({
      key,
      label: l.label,
      unit: l.unit,
      group: l.group,
      from: a ?? null,
      to: b ?? null,
    });
  }
  return out.sort(figureOrder(groups));
}

/** The figures an added or removed entry is introduced by. */
function headline(
  figures: PatchFigures,
  keys: readonly string[],
  labelOf: (path: string) => FigureLabel,
  side: "from" | "to",
): FigureChange[] {
  return keys.flatMap((key) => {
    const v = figures[key];
    if (v === undefined) return [];
    const l = labelOf(key);
    return [
      {
        key,
        label: l.label,
        unit: l.unit,
        group: l.group,
        from: side === "from" ? v : null,
        to: side === "to" ? v : null,
      },
    ];
  });
}

const SHIP_HEADLINE = [
  "size_class",
  "role",
  "health",
  "shield.hp",
  "speed.scm",
  "cargo_capacity",
  "crew.max",
];

const PART_HEADLINE = [
  "vehicle_weapon.damage.burst",
  "vehicle_weapon.damage.alpha_total",
  "missile.damage_total",
  "shield.max_health",
  "power_plant.power_segment_generation",
  "cooler.coolant_segment_generation",
  "quantum_drive.standard_jump.drive_speed",
  "durability.health",
];

const BLUEPRINT_HEADLINE = ["craft_time_seconds", "is_available_by_default"];

const byName = (a: EntryChange, b: EntryChange): number =>
  a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en");

/** Sorted by name; entries that share a name (an edition, a showroom copy) add the game's class name. */
function sortedEntries(list: EntryChange[]): EntryChange[] {
  const seen = new Map<string, number>();
  for (const e of list) seen.set(e.name, (seen.get(e.name) ?? 0) + 1);
  return list
    .map((e) =>
      (seen.get(e.name) ?? 0) > 1
        ? { ...e, detail: e.detail === null ? e.id : `${e.detail} · ${e.id}` }
        : e,
    )
    .sort(byName);
}

function partRef(
  cls: string,
  links: Links,
  from: PatchSnapshot,
  to: PatchSnapshot,
): PartRef {
  const linked = links.part(cls);
  if (linked !== null) return linked;
  const name = to.parts[cls]?.name ?? from.parts[cls]?.name ?? cls;
  return { className: cls, name, href: null };
}

function loadoutChanges(
  a: PatchShip,
  b: PatchShip,
  links: Links,
  from: PatchSnapshot,
  to: PatchSnapshot,
): LoadoutChange[] {
  const ports = new Set([...Object.keys(a.loadout), ...Object.keys(b.loadout)]);
  const out: LoadoutChange[] = [];
  for (const port of [...ports].sort()) {
    const was = a.loadout[port];
    const now = b.loadout[port];
    if (was === now) continue;
    const leaf = port.split("/").at(-1) ?? port;
    out.push({
      port,
      place: placeOf(leaf),
      from: was === undefined ? null : partRef(was, links, from, to),
      to: now === undefined ? null : partRef(now, links, from, to),
    });
  }
  return out;
}

/** The maker's name where the pack knows the code, else the code. */
function makerOf(code: string | null, links: Links): string | null {
  return code === null ? null : (links.maker(code) ?? code);
}

function partDetail(
  p: {
    size: number | null;
    grade: string | null;
    manufacturer: string | null;
    sub_type: string | null;
  },
  links: Links,
): string | null {
  const bits = [
    p.size === null ? null : `Size ${p.size}`,
    p.grade === null ? null : `Grade ${p.grade}`,
    makerOf(p.manufacturer, links),
  ].filter((x): x is string => x !== null);
  return bits.length === 0 ? null : bits.join(" · ");
}

function ingredientChanges(
  a: Readonly<Record<string, PatchIngredient>>,
  b: Readonly<Record<string, PatchIngredient>>,
): IngredientChange[] {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: IngredientChange[] = [];
  for (const name of [...names].sort((x, y) => x.localeCompare(y, "en"))) {
    const x = a[name];
    const y = b[name];
    if (
      x !== undefined &&
      y !== undefined &&
      x.amount === y.amount &&
      x.unit === y.unit
    )
      continue;
    out.push({ name, from: x ?? null, to: y ?? null });
  }
  return out;
}

/** Families for the parts section; a type no family names gets one of its own. */
function familyOf(type: string): { id: string; label: string } {
  const f = PART_FAMILIES.find((fam) => fam.types.includes(type));
  return f ?? { id: type.toLowerCase(), label: humanize(type) };
}

export function compareSnapshots(
  from: PatchSnapshot,
  to: PatchSnapshot,
  links: Links = NO_LINKS,
): Omit<PatchComparison, "from" | "to"> {
  const unrecorded = { count: 0 };
  let uncompared = 0;

  // Ships.
  const shipStated = {
    from: statedKeys(Object.values(from.ships)),
    to: statedKeys(Object.values(to.ships)),
  };
  const ships = {
    added: [] as EntryChange[],
    removed: [] as EntryChange[],
    changed: [] as EntryChange[],
  };
  const shipIds = new Set([
    ...Object.keys(from.ships),
    ...Object.keys(to.ships),
  ]);
  for (const id of shipIds) {
    const a = from.ships[id];
    const b = to.ships[id];
    const base = {
      id,
      href: links.ship(id),
      ingredients: [],
    };
    if (a === undefined && b !== undefined) {
      // Listed in the older build without figures: not new, just not recorded then.
      if (from.unrecorded_ships.includes(id)) {
        uncompared += 1;
        continue;
      }
      ships.added.push({
        ...base,
        name: b.name,
        gameName: b.game_name,
        status: "added",
        detail: makerOf(b.manufacturer, links),
        figures: headline(b.figures, SHIP_HEADLINE, shipFigureLabel, "to"),
        loadout: [],
      });
    } else if (a !== undefined && b === undefined) {
      // Still in the build's list, without figures: not removed, just not recorded.
      if (to.unrecorded_ships.includes(id)) {
        uncompared += 1;
        continue;
      }
      ships.removed.push({
        ...base,
        name: a.name,
        gameName: a.game_name,
        status: "removed",
        detail: makerOf(a.manufacturer, links),
        figures: headline(a.figures, SHIP_HEADLINE, shipFigureLabel, "from"),
        loadout: [],
      });
    } else if (a !== undefined && b !== undefined) {
      const figures = figureChanges(
        a.figures,
        b.figures,
        shipStated.from,
        shipStated.to,
        shipFigureLabel,
        SHIP_GROUPS,
        unrecorded,
      );
      const loadout = loadoutChanges(a, b, links, from, to);
      if (figures.length === 0 && loadout.length === 0) continue;
      ships.changed.push({
        ...base,
        name: b.name,
        gameName: b.game_name ?? a.game_name,
        status: "changed",
        detail: makerOf(b.manufacturer, links),
        figures,
        loadout,
      });
    }
  }

  // Parts, by family.
  // What a build states is judged per part type: a shield's figure is not a gun's.
  const statedBy = (parts: PatchSnapshot["parts"]) => {
    const byType = new Map<string, PatchSnapshot["parts"][string][]>();
    for (const p of Object.values(parts)) {
      const list = byType.get(p.type) ?? [];
      list.push(p);
      byType.set(p.type, list);
    }
    return new Map([...byType].map(([t, list]) => [t, statedKeys(list)]));
  };
  const partStated = { from: statedBy(from.parts), to: statedBy(to.parts) };
  const none = new Set<string>();
  const families = new Map<
    string,
    {
      id: string;
      label: string;
      added: EntryChange[];
      removed: EntryChange[];
      changed: EntryChange[];
    }
  >();
  const familyFor = (type: string) => {
    const f = familyOf(type);
    let entry = families.get(f.id);
    if (entry === undefined) {
      entry = { ...f, added: [], removed: [], changed: [] };
      families.set(f.id, entry);
    }
    return entry;
  };
  const partIds = new Set([
    ...Object.keys(from.parts),
    ...Object.keys(to.parts),
  ]);
  for (const id of partIds) {
    const a = from.parts[id];
    const b = to.parts[id];
    const ref = links.part(id);
    if (a === undefined && b !== undefined) {
      familyFor(b.type).added.push({
        id,
        name: b.name,
        gameName: null,
        status: "added",
        href: ref?.href ?? null,
        detail: partDetail(b, links),
        figures: headline(b.figures, PART_HEADLINE, partFigureLabel, "to"),
        loadout: [],
        ingredients: [],
      });
    } else if (a !== undefined && b === undefined) {
      familyFor(a.type).removed.push({
        id,
        name: a.name,
        gameName: null,
        status: "removed",
        href: ref?.href ?? null,
        detail: partDetail(a, links),
        figures: headline(a.figures, PART_HEADLINE, partFigureLabel, "from"),
        loadout: [],
        ingredients: [],
      });
    } else if (a !== undefined && b !== undefined) {
      const figures = figureChanges(
        a.figures,
        b.figures,
        partStated.from.get(a.type) ?? none,
        partStated.to.get(b.type) ?? none,
        partFigureLabel,
        PART_GROUPS,
        unrecorded,
      );
      if (figures.length === 0) continue;
      familyFor(b.type).changed.push({
        id,
        name: b.name,
        gameName: null,
        status: "changed",
        href: ref?.href ?? null,
        detail: partDetail(b, links),
        figures,
        loadout: [],
        ingredients: [],
      });
    }
  }
  const order = PART_FAMILIES.map((f) => f.id);
  const parts = [...families.values()]
    .filter((f) => f.added.length + f.removed.length + f.changed.length > 0)
    .sort((x, y) => {
      const ix = order.indexOf(x.id);
      const iy = order.indexOf(y.id);
      return (
        (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) ||
        x.label.localeCompare(y.label)
      );
    })
    .map((f) => ({
      ...f,
      added: sortedEntries(f.added),
      removed: sortedEntries(f.removed),
      changed: sortedEntries(f.changed),
    }));

  // Blueprints.
  const bpStated = {
    from: statedKeys(Object.values(from.blueprints)),
    to: statedKeys(Object.values(to.blueprints)),
  };
  const blueprints = {
    added: [] as EntryChange[],
    removed: [] as EntryChange[],
    changed: [] as EntryChange[],
  };
  const bpIds = new Set([
    ...Object.keys(from.blueprints),
    ...Object.keys(to.blueprints),
  ]);
  const outputRef = (cls: string | null): string | null =>
    cls === null ? null : (links.part(cls)?.href ?? null);
  for (const id of bpIds) {
    const a = from.blueprints[id];
    const b = to.blueprints[id];
    if (a === undefined && b !== undefined) {
      blueprints.added.push({
        id,
        name: b.output_name,
        gameName: null,
        status: "added",
        href: outputRef(b.output_class),
        detail: null,
        figures: headline(
          b.figures,
          BLUEPRINT_HEADLINE,
          blueprintFigureLabel,
          "to",
        ),
        loadout: [],
        ingredients: ingredientChanges({}, b.ingredients),
      });
    } else if (a !== undefined && b === undefined) {
      blueprints.removed.push({
        id,
        name: a.output_name,
        gameName: null,
        status: "removed",
        href: outputRef(a.output_class),
        detail: null,
        figures: headline(
          a.figures,
          BLUEPRINT_HEADLINE,
          blueprintFigureLabel,
          "from",
        ),
        loadout: [],
        ingredients: ingredientChanges(a.ingredients, {}),
      });
    } else if (a !== undefined && b !== undefined) {
      const figures = figureChanges(
        a.figures,
        b.figures,
        bpStated.from,
        bpStated.to,
        blueprintFigureLabel,
        ["Blueprint"],
        unrecorded,
      );
      const ingredients = ingredientChanges(a.ingredients, b.ingredients);
      if (figures.length === 0 && ingredients.length === 0) continue;
      blueprints.changed.push({
        id,
        name: b.output_name,
        gameName: null,
        status: "changed",
        href: outputRef(b.output_class),
        detail: null,
        figures,
        loadout: [],
        ingredients,
      });
    }
  }

  return {
    ships: {
      added: sortedEntries(ships.added),
      removed: sortedEntries(ships.removed),
      changed: sortedEntries(ships.changed),
    },
    parts,
    blueprints: {
      added: sortedEntries(blueprints.added),
      removed: sortedEntries(blueprints.removed),
      changed: sortedEntries(blueprints.changed),
    },
    unrecorded: unrecorded.count,
    uncompared,
  };
}

export function compareBuilds(
  from: Build,
  to: Build,
  links: Links = NO_LINKS,
): PatchComparison | null {
  const a = snapshotOf(from.code);
  const b = snapshotOf(to.code);
  if (a === null || b === null) return null;
  return { from, to, ...compareSnapshots(a, b, links) };
}

export const countOf = (c: ChangeSet): number =>
  c.added.length + c.removed.length + c.changed.length;

export function totals(c: Omit<PatchComparison, "from" | "to">): {
  ships: number;
  parts: number;
  blueprints: number;
} {
  return {
    ships: countOf(c.ships),
    parts: c.parts.reduce((n, f) => n + countOf(f), 0),
    blueprints: countOf(c.blueprints),
  };
}

// ---------------------------------------------------------------------------------------------

export interface Mention {
  readonly note: PatchNote;
  readonly section: string;
  readonly text: string;
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The lines of the notes that name a ship. A line names a ship when it contains the ship's
 * in-game name, maker first ("Drake Cutlass Black"), as whole words; a name of two words or more
 * also counts without the maker ("Cutlass Black"). One-word names alone ("Gladius") are not
 * matched: a word is not a name with the confidence ADR-049 asks of a link (0.9 or more). Where
 * one name sits inside a longer one ("Esperia Prowler" in "Esperia Prowler Utility"), the line
 * names the longer ship only, unless the shorter one also stands on its own in it.
 */
export function shipMentions(
  notes: readonly PatchNote[],
  ships: readonly { id: string; name: string; gameName: string | null }[],
): Map<string, Mention[]> {
  const patterns = ships.flatMap((s) => {
    const names = new Set<string>();
    if (s.gameName !== null && s.gameName.split(/\s+/).length >= 2)
      names.add(s.gameName);
    if (s.name.split(/\s+/).length >= 2) names.add(s.name);
    if (names.size === 0) return [];
    const re = new RegExp(
      `(?<![\\w-])(?:${[...names].map(escape).join("|")})(?![\\w-])`,
      "gi",
    );
    return [{ id: s.id, re }];
  });
  const out = new Map<string, Mention[]>();
  for (const note of notes) {
    for (const section of note.sections) {
      for (const group of section.groups) {
        for (const text of group.items) {
          const spans = patterns.flatMap((p) =>
            [...text.matchAll(p.re)].map((m) => ({
              id: p.id,
              start: m.index,
              end: m.index + m[0].length,
            })),
          );
          const inside = (s: (typeof spans)[number]): boolean =>
            spans.some(
              (o) =>
                o.start <= s.start &&
                o.end >= s.end &&
                o.end - o.start > s.end - s.start,
            );
          const named = new Set(
            spans.filter((s) => !inside(s)).map((s) => s.id),
          );
          for (const id of named) {
            const list = out.get(id) ?? [];
            if (!list.some((m) => m.text === text))
              list.push({ note, section: section.title, text });
            out.set(id, list);
          }
        }
      }
    }
  }
  return out;
}

/** The notes for a comparison: every post for a version after `from` up to and including `to`. */
export function notesBetween(
  notes: readonly PatchNote[],
  from: string | null,
  to: string,
): PatchNote[] {
  return notes.filter(
    (n) =>
      compareVersions(n.version, to) <= 0 &&
      (from === null || compareVersions(n.version, from) > 0),
  );
}
