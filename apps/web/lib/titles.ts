import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Title,
  TitleCatalog,
  type TitleGroup,
  type WikiText,
} from "schema";
import { type SearchEntry, formatNumber } from "ui";
import { REPO_ROOT } from "./data";

/**
 * The titles page's data and URL state (ADR-017). The catalogue is `fixtures/titles/Titles.json`,
 * copied by `scripts/titles/fetch.ts` from the Star Citizen Wiki and validated here. Filters are
 * URL state (`q`, `group`, `status`), parsed and applied by pure functions the unit tests cover.
 */

export const TITLES_FILE = join(REPO_ROOT, "fixtures", "titles", "Titles.json");

/** Reads and validates the catalogue; null when the file is absent. */
export function loadTitleCatalog(): TitleCatalog | null {
  if (!existsSync(TITLES_FILE)) return null;
  return TitleCatalog.parse(JSON.parse(readFileSync(TITLES_FILE, "utf8")));
}

let cached: TitleCatalog | null | undefined;

/** The catalogue, read once per server process. */
export function titleCatalog(): TitleCatalog | null {
  if (cached === undefined) cached = loadTitleCatalog();
  return cached;
}

/** Interface labels for the groups, in sentence case; the wiki's own headings stay in the data. */
export const GROUP_LABELS: Readonly<Record<TitleGroup, string>> = {
  backer: "Backer",
  recruitment: "Recruitment",
  guide: "Guide",
  minigame: "Minigames",
  arena_commander: "Arena Commander",
  persistent_universe: "Persistent Universe",
  website_event: "Website events",
  other: "Other",
  unique: "Unique",
  official: "Official",
};

/** The group's URL value and section anchor: `arena_commander` → `arena-commander`. */
export const groupSlug = (group: TitleGroup): string =>
  group.replace(/_/g, "-");

export const STATUS_OPTIONS = [
  { value: "earnable", label: "Earnable" },
  { value: "not-earnable", label: "No longer earnable" },
  { value: "unknown", label: "Status unknown" },
] as const;
export type TitleStatus = (typeof STATUS_OPTIONS)[number]["value"];

const STATUS_OF: Readonly<Record<"yes" | "no" | "unknown", TitleStatus>> = {
  yes: "earnable",
  no: "not-earnable",
  unknown: "unknown",
};

/** The status a title shows; null for unique and official titles, where it does not apply. */
export function statusOf(title: Title): TitleStatus | null {
  return title.earnable === null ? null : STATUS_OF[title.earnable];
}

export interface TitleQuery {
  /** Trimmed search text; "" when none. */
  readonly q: string;
  readonly group: TitleGroup | null;
  readonly status: TitleStatus | null;
}

export type Query = Readonly<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined): string =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

/** Unknown values are ignored, so a stale or mistyped link still shows every title. */
export function parseTitleQuery(query: Query): TitleQuery {
  const group = first(query["group"]);
  const status = first(query["status"]);
  return {
    q: first(query["q"]).slice(0, 100),
    group:
      (Object.keys(GROUP_LABELS) as TitleGroup[]).find(
        (g) => groupSlug(g) === group,
      ) ?? null,
    status: STATUS_OPTIONS.find((s) => s.value === status)?.value ?? null,
  };
}

export const hasTitleFilters = (query: TitleQuery): boolean =>
  query.q !== "" || query.group !== null || query.status !== null;

/** The page's address for a query, without empty values, in the form's field order. */
export function titlesHref(query: TitleQuery): string {
  const params = new URLSearchParams();
  if (query.q !== "") params.set("q", query.q);
  if (query.group !== null) params.set("group", groupSlug(query.group));
  if (query.status !== null) params.set("status", query.status);
  const text = params.toString();
  return text === "" ? "/titles" : `/titles?${text}`;
}

export const wikiText = (runs: WikiText): string =>
  runs.map((r) => r.text).join("");

/** Lower-case, accents removed, so "IAE" finds "iae" and "e" finds "é". */
const fold = (text: string): string =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

/** Everything a search looks through for one title. */
export function searchText(title: Title): string {
  const req = title.requirement;
  return fold(
    [
      title.name,
      GROUP_LABELS[title.group],
      req?.kind === "guide_sessions" ? `${req.track} ${req.rank}` : "",
      req?.kind === "recruitment_period" ? req.period : "",
      title.earned_by === null ? "" : wikiText(title.earned_by),
      title.reward?.name ?? "",
      title.reward === null ? "" : wikiText(title.reward.text),
      ...(title.packages ?? []),
    ].join(" "),
  );
}

export function filterTitles(
  titles: readonly Title[],
  query: TitleQuery,
): Title[] {
  const words = fold(query.q).split(/\s+/).filter(Boolean);
  return titles.filter(
    (t) =>
      (query.group === null || t.group === query.group) &&
      (query.status === null || statusOf(t) === query.status) &&
      (words.length === 0 || words.every((w) => searchText(t).includes(w))),
  );
}

export interface TitleSection {
  readonly group: TitleGroup;
  readonly label: string;
  /** The wiki's paragraphs for the group. */
  readonly intro: readonly WikiText[];
  readonly titles: readonly Title[];
  /** Titles in the group before filtering. */
  readonly total: number;
}

/** The groups that have titles to show, in the wiki's order. */
export function titleSections(
  catalog: TitleCatalog,
  shown: readonly Title[],
): TitleSection[] {
  return catalog.groups
    .map((g) => ({
      group: g.group,
      label: GROUP_LABELS[g.group],
      intro: g.intro,
      titles: shown.filter((t) => t.group === g.group),
      total: catalog.titles.filter((t) => t.group === g.group).length,
    }))
    .filter((s) => s.titles.length > 0);
}

/** A guide track's titles by rank, with null where the track has no title at that rank. */
export interface GuideTrack {
  readonly track: string;
  readonly cells: readonly (Title | null)[];
}

export interface GuideGrid {
  readonly ranks: readonly {
    readonly rank: string;
    readonly sessions: number;
  }[];
  readonly tracks: readonly GuideTrack[];
}

export function guideGrid(titles: readonly Title[]): GuideGrid {
  const ranks: { rank: string; sessions: number }[] = [];
  const tracks = new Map<string, Map<string, Title>>();
  for (const t of titles) {
    const req = t.requirement;
    if (req?.kind !== "guide_sessions") continue;
    if (!ranks.some((r) => r.rank === req.rank)) {
      ranks.push({ rank: req.rank, sessions: req.sessions });
    }
    const row = tracks.get(req.track) ?? new Map<string, Title>();
    row.set(req.rank, t);
    tracks.set(req.track, row);
  }
  ranks.sort((a, b) => a.sessions - b.sessions);
  return {
    ranks,
    tracks: [...tracks].map(([track, row]) => ({
      track,
      cells: ranks.map((r) => row.get(r.rank) ?? null),
    })),
  };
}

/** Command palette entries: every title, linking to its place on the page. */
export function titleSearchEntries(
  catalog: TitleCatalog | null,
): SearchEntry[] {
  if (catalog === null) return [];
  return catalog.titles.map((t) => {
    const req = t.requirement;
    return {
      type: "title" as const,
      name: t.name,
      href: `/titles#${t.slug}`,
      meta:
        req?.kind === "guide_sessions"
          ? `${GROUP_LABELS[t.group]} · ${req.track}`
          : GROUP_LABELS[t.group],
    };
  });
}

/** The aside beside a group's heading: how many titles, and how many can still be earned. */
export function countLine(
  titles: readonly Title[],
  total: number,
  filtered: boolean,
): string {
  const n = titles.length;
  const count =
    filtered && n < total
      ? `${formatNumber(n)} of ${formatNumber(total)} titles`
      : `${formatNumber(n)} ${n === 1 ? "title" : "titles"}`;
  const statuses = titles.map(statusOf).filter((s) => s !== null);
  if (statuses.length === 0) return count;
  const earnable = statuses.filter((s) => s === "earnable").length;
  const unknown = statuses.filter((s) => s === "unknown").length;
  if (earnable === n) return `${count} · all earnable`;
  if (unknown === n) return `${count} · status unknown`;
  const parts = [
    earnable === 0 ? "none earnable now" : `${formatNumber(earnable)} earnable`,
    ...(unknown > 0 ? [`${formatNumber(unknown)} status unknown`] : []),
  ];
  return [count, ...parts].join(" · ");
}
