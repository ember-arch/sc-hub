import {
  type PlateCandidate,
  dailyPicks,
  pickPlates,
  shuffled,
  utcDayNumber,
  utcWeekNumber,
} from "./front";

/**
 * The front page's featured ships (ADR-060): what is happening in the game decides them. A show
 * day brings that day's ships; the week after a LIVE patch, the ships it brought; the week after
 * CIG names a ship in a Comm-Link or video title, that ship; each with ships of its line or its
 * kind, changing daily. With none of those, the showcase pair and three ships drawn for the week
 * (ADR-010, ADR-038). Pure functions of plain values; `featured-sources.ts` reads the pack.
 */

/** A ship as the featured rule reads it. */
export interface FeaturedCandidate extends PlateCandidate {
  /** The register's name ("Constellation Mk V Centaurus"), without the maker. */
  readonly name: string;
  readonly makerCode: string;
  /** The pack's role, or a concept's focus: "Light Fighter", "Multi-Role / Light Carrier". */
  readonly role: string | null;
}

/** The bento's cards: the large one, the tall one beside it, three across (ADR-021). */
export const FEATURED_COUNT = 5;
/** How long a LIVE patch's new ships lead, from the day CIG released it. */
export const RELEASE_DAYS = 7;
/** How long a ship CIG names in a title leads, from the post. */
export const NEWS_DAYS = 7;

/** Why a card is on the bento: its note says so. */
export type Why =
  /** One of the owner's showcase pair (ADR-010). */
  | { readonly kind: "pair" }
  /** Drawn for the week, or to fill a themed set. */
  | { readonly kind: "drawn" }
  /** On the show's schedule for the day. */
  | { readonly kind: "show" }
  /** A limited hull whose waves start on the show's day. */
  | { readonly kind: "limited" }
  /** New in the LIVE patch. */
  | { readonly kind: "new"; readonly version: string }
  /** Named in a title CIG published. */
  | { readonly kind: "news" }
  /** Of a lead's line: same maker, same first word ("Constellation"). */
  | { readonly kind: "line"; readonly of: string }
  /** Of a lead's kind: a role in common ("Dropship"). */
  | { readonly kind: "like"; readonly of: string }
  /** By a lead's maker. */
  | { readonly kind: "maker" };

export interface FeaturedPick<T> {
  readonly ship: T;
  readonly why: Why;
}

export type Theme =
  | { readonly kind: "show" }
  | { readonly kind: "release"; readonly version: string }
  | { readonly kind: "news" }
  | { readonly kind: "week" };

export interface Featured<T> {
  readonly theme: Theme;
  /** Daily for a moment in the game, weekly otherwise. */
  readonly cadence: "daily" | "weekly";
  readonly picks: readonly FeaturedPick<T>[];
}

/** The show's day as the rule needs it: the day's ships in RSI's order, and its limited hulls. */
export interface ShowInput {
  readonly slugs: readonly string[];
  readonly limited: readonly string[];
}

/** The newest LIVE patch's new ships, and when CIG released it. */
export interface ReleaseInput {
  readonly version: string;
  readonly releasedAt: string;
  readonly slugs: readonly string[];
}

/** A ship CIG named in a title, and when it published it. */
export interface NewsMention {
  readonly slug: string;
  readonly published_at: string;
}

export interface FeaturedInput<T extends FeaturedCandidate> {
  readonly candidates: readonly T[];
  readonly now: Date;
  /** The showcase pair (ADR-010), for a week with nothing on. */
  readonly pair: { readonly live: string; readonly concept: string };
  /** The show's day while one is on the front page (ADR-057), else null. */
  readonly show: ShowInput | null;
  readonly release: ReleaseInput | null;
  readonly news: readonly NewsMention[];
}

const DAY_MS = 86_400_000;

/** The first word of a name, as a line's key: "Constellation Mk V Centaurus" → "constellation". */
const lineKey = (name: string): string =>
  (name.trim().split(/\s+/)[0] ?? "").toLowerCase();

const SIZE = /^(?:light|medium|heavy|snub|stealth|small|large)\s+/i;

/**
 * The kinds of play a role names, its size words aside: "Light Freight, Medium Fighter" →
 * freight and fighter; "Multi-Role / Light Carrier" → multi-role and carrier.
 */
export function playStyles(role: string | null): ReadonlySet<string> {
  if (role === null) return new Set();
  return new Set(
    role
      .split(/[,/]/)
      .map((part) => part.trim().replace(SIZE, "").trim().toLowerCase())
      .filter((part) => part !== ""),
  );
}

type Tier = "line" | "role" | "like" | "maker";

/**
 * How a ship stands to a lead: of its line, of its very role ("Snub Fighter"), of its kind (a
 * fighter of any size), by its maker, or none of those.
 */
function relation<T extends FeaturedCandidate>(
  lead: T,
  other: T,
): { tier: Tier; why: Why } | null {
  if (
    other.makerCode === lead.makerCode &&
    lineKey(other.name) === lineKey(lead.name)
  ) {
    return {
      tier: "line",
      why: { kind: "line", of: lead.name.trim().split(/\s+/)[0]! },
    };
  }
  const like = { kind: "like", of: lead.name } as const;
  if (
    lead.role !== null &&
    other.role !== null &&
    lead.role.trim().toLowerCase() === other.role.trim().toLowerCase()
  ) {
    return { tier: "role", why: like };
  }
  const styles = playStyles(lead.role);
  for (const style of playStyles(other.role)) {
    if (styles.has(style)) return { tier: "like", why: like };
  }
  if (other.makerCode === lead.makerCode) {
    return { tier: "maker", why: { kind: "maker" } };
  }
  return null;
}

const TIERS: readonly Tier[] = ["line", "role", "like", "maker"];

/**
 * The ships that go with the leads, `need` of them at most: first those of a lead's line, then of
 * its very role, then of its kind, then by its maker, each tier taken a lead at a time in turn, in an order seeded by
 * `seed` so the set changes with it.
 */
export function companions<T extends FeaturedCandidate>(
  leads: readonly T[],
  pool: readonly T[],
  seed: number,
  need: number,
  taken: ReadonlySet<string> = new Set(leads.map((l) => l.slug)),
): FeaturedPick<T>[] {
  const out: FeaturedPick<T>[] = [];
  const used = new Set(taken);
  const order = shuffled(pool, seed);
  for (const tier of TIERS) {
    const queues = leads.map((lead) =>
      order.flatMap((ship) => {
        if (used.has(ship.slug)) return [];
        const rel = relation(lead, ship);
        return rel !== null && rel.tier === tier
          ? [{ ship, why: rel.why }]
          : [];
      }),
    );
    for (let i = 0; out.length < need; i += 1) {
      if (queues.every((q) => i >= q.length)) break;
      for (const queue of queues) {
        const pick = queue[i];
        if (pick === undefined || used.has(pick.ship.slug)) continue;
        used.add(pick.ship.slug);
        out.push(pick);
        if (out.length >= need) break;
      }
    }
    if (out.length >= need) break;
  }
  return out;
}

/** The candidates the bento draws from: those with a picture, or all when none has one (CI). */
function drawable<T extends PlateCandidate>(candidates: readonly T[]): T[] {
  const pictured = candidates.filter((c) => c.hasPicture);
  return pictured.length > 0 ? pictured : [...candidates];
}

/** A themed set: the leads, then their companions, then ships drawn for the day to fill it. */
function themed<T extends FeaturedCandidate>(
  first: readonly FeaturedPick<T>[],
  pool: readonly T[],
  seed: number,
): FeaturedPick<T>[] {
  const picks = first.slice(0, FEATURED_COUNT);
  const taken = new Set(picks.map((p) => p.ship.slug));
  const leads = picks
    .filter((p) => p.why.kind !== "limited")
    .map((p) => p.ship);
  const more = companions(
    leads,
    pool,
    seed,
    FEATURED_COUNT - picks.length,
    taken,
  );
  for (const p of more) taken.add(p.ship.slug);
  const fill = shuffled(
    pool.filter((c) => !taken.has(c.slug)),
    seed,
    FEATURED_COUNT - picks.length - more.length,
  ).map((ship) => ({ ship, why: { kind: "drawn" } as const }));
  return [...picks, ...more, ...fill];
}

/** Each slug once, in its first place, as the pool's ship; slugs the pool lacks are dropped. */
function resolveAll<T extends PlateCandidate>(
  slugs: readonly string[],
  pool: readonly T[],
): T[] {
  const bySlug = new Map(pool.map((c) => [c.slug, c]));
  const seen = new Set<string>();
  return slugs.flatMap((slug) => {
    const ship = bySlug.get(slug);
    if (ship === undefined || seen.has(slug)) return [];
    seen.add(slug);
    return [ship];
  });
}

/** The ships CIG named within `NEWS_DAYS` before `now`, the newest post first. */
export function recentMentions(
  news: readonly NewsMention[],
  now: Date,
): string[] {
  const at = now.getTime();
  return [...news]
    .filter((m) => {
      const t = Date.parse(m.published_at);
      return t <= at && at - t < NEWS_DAYS * DAY_MS;
    })
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .map((m) => m.slug);
}

/** Whether the patch is within its first `RELEASE_DAYS` days at `now`. */
export function releaseOn(release: ReleaseInput, now: Date): boolean {
  const t = Date.parse(release.releasedAt);
  const at = now.getTime();
  return t <= at && at - t < RELEASE_DAYS * DAY_MS;
}

/**
 * The featured ships at a moment. In order, the first that has a ship to show:
 * 1. a show's day: its first ship, the day's limited hulls, the ships CIG named lately, then the
 *    rest of the day's ships in the day's draw;
 * 2. the newest LIVE patch's new ships, in its first week;
 * 3. the ships CIG named in a title within the week;
 * each followed by ships of the leads' line, then of their kind, then by their maker, and changing
 * with the UTC day. Otherwise the showcase pair and three drawn for the UTC week.
 */
export function featuredShips<T extends FeaturedCandidate>(
  input: FeaturedInput<T>,
): Featured<T> {
  const pool = drawable(input.candidates);
  const day = utcDayNumber(input.now);
  const named = recentMentions(input.news, input.now);

  if (input.show !== null) {
    const listed = resolveAll(input.show.slugs, pool);
    if (listed.length > 0) {
      const [lead, ...rest] = listed;
      const limited = resolveAll(input.show.limited, pool).filter(
        (s) => s.slug !== lead!.slug,
      );
      const limitedSlugs = new Set(limited.map((s) => s.slug));
      const others = rest.filter((s) => !limitedSlugs.has(s.slug));
      const namedSet = new Set(named);
      const inNews = others.filter((s) => namedSet.has(s.slug));
      const drawn = shuffled(
        others.filter((s) => !namedSet.has(s.slug)),
        day,
      );
      return {
        theme: { kind: "show" },
        cadence: "daily",
        picks: themed(
          [
            { ship: lead!, why: { kind: "show" } },
            ...limited.map((ship) => ({
              ship,
              why: { kind: "limited" } as const,
            })),
            ...[...inNews, ...drawn].map((ship) => ({
              ship,
              why: { kind: "show" } as const,
            })),
          ],
          pool,
          day,
        ),
      };
    }
  }

  const release = input.release;
  if (release !== null && releaseOn(release, input.now)) {
    // The new ships CIG named in its posts lead the others.
    const namedSet = new Set(named);
    const leads = resolveAll(release.slugs, pool).sort(
      (a, b) => Number(namedSet.has(b.slug)) - Number(namedSet.has(a.slug)),
    );
    if (leads.length > 0) {
      return {
        theme: { kind: "release", version: release.version },
        cadence: "daily",
        picks: themed(
          leads.map((ship) => ({
            ship,
            why: { kind: "new", version: release.version } as const,
          })),
          pool,
          day,
        ),
      };
    }
  }

  const inNews = resolveAll(named, pool);
  if (inNews.length > 0) {
    return {
      theme: { kind: "news" },
      cadence: "daily",
      picks: themed(
        inNews.map((ship) => ({ ship, why: { kind: "news" } as const })),
        pool,
        day,
      ),
    };
  }

  // A week with nothing on: the owner's pair (ADR-010) and three drawn for the week (ADR-038).
  const pair = pickPlates(
    input.candidates,
    input.pair.live,
    input.pair.concept,
    0,
  );
  const drawn = dailyPicks(
    input.candidates.filter((c) => !pair.some((p) => p.slug === c.slug)),
    utcWeekNumber(day),
    FEATURED_COUNT - 2,
  );
  return {
    theme: { kind: "week" },
    cadence: "weekly",
    picks: [
      ...pair.map((ship) => ({ ship, why: { kind: "pair" } as const })),
      ...drawn.map((ship) => ({ ship, why: { kind: "drawn" } as const })),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Reading the pack: which ships a title names, which ships a patch brought.

/** A ship as a title may name it: its slug, its name, and the words its maker goes by. */
export interface NamedShip {
  readonly slug: string;
  readonly name: string;
  /** "RSI", "Roberts Space Industries", "Roberts": the code, the name, its first word. */
  readonly makers: readonly string[];
}

/** The words a maker goes by in CIG's titles: its code, its name and its name's first word. */
export function makerWords(code: string, name: string | null): string[] {
  const words = [code];
  if (name !== null) words.push(name, name.split(/\s+/)[0]!);
  return [...new Set(words.filter((w) => w.trim() !== ""))];
}

const WORD = /[A-Za-z0-9]/;

/**
 * The ships a title names, in the order it names them: the maker and the ship's whole name, with
 * nothing of a word on either side ("RSI Galaxy - Mission Made", "Behind the Ships: RSI Galaxy";
 * "the galaxy" and "RSI Constellation Mk IV Celebration" name none). Case counts; where two names
 * overlap, the longer is the one named ("RSI Aurora Mk II" is not the Aurora).
 */
export function shipsNamedIn(
  title: string,
  ships: readonly NamedShip[],
): string[] {
  const hits: { at: number; length: number; slug: string }[] = [];
  for (const ship of ships) {
    for (const maker of ship.makers) {
      const phrase = `${maker} ${ship.name}`;
      for (let at = title.indexOf(phrase); at >= 0;) {
        const before = at === 0 ? "" : title[at - 1]!;
        const after = title[at + phrase.length] ?? "";
        if (!WORD.test(before) && !WORD.test(after)) {
          hits.push({ at, length: phrase.length, slug: ship.slug });
        }
        at = title.indexOf(phrase, at + 1);
      }
    }
  }
  hits.sort((a, b) => a.at - b.at || b.length - a.length);
  const out: string[] = [];
  let end = -1;
  for (const hit of hits) {
    // A hit inside a longer one already taken is that ship's name, not another's.
    if (hit.at < end) continue;
    end = hit.at + hit.length;
    if (!out.includes(hit.slug)) out.push(hit.slug);
  }
  return out;
}

/** A ship record of a patch snapshot as the rule reads it. */
export interface SnapshotShip {
  readonly name: string;
  readonly manufacturer: string | null;
}

/**
 * The records of a build that bring a name: their name and maker had no record in the build
 * before. A new record of a name already there (4.10.3's second Caterpillar, ADR-054) is a
 * variant, not a new ship.
 */
export function newShips(
  before: Readonly<Record<string, SnapshotShip>>,
  after: Readonly<Record<string, SnapshotShip>>,
): string[] {
  const key = (s: SnapshotShip) =>
    `${s.manufacturer ?? ""}\u0000${s.name.trim()}`;
  const known = new Set(Object.values(before).map(key));
  return Object.entries(after)
    .filter(([id, s]) => !(id in before) && !known.has(key(s)))
    .map(([id]) => id)
    .sort();
}
