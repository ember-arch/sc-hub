/**
 * RSI's store listing as the source of every ship's holoviewer model (ADR-025). The pledge store's
 * ship pages are an app; the one place each ship's model address is written is the store's own
 * data endpoint, which the ship list and every ship page read without a sign-in. This module
 * holds the one query this project sends there, the shape it accepts back (anything else halts
 * the run), and the match from a store ship to a catalog ship, which is exact: the store's page
 * address for the ship equals the ship-matrix page address `fetch-rsi.ts` already recorded.
 * Pure: `fetch-holo.ts` does the requests.
 */
import { z } from "zod";
import { RSI_ORIGIN } from "./sources.js";

export const STORE_GRAPHQL_URL = `${RSI_ORIGIN}/graphql`;

/** The store lists thirty ships a page whatever limit is asked for. */
export const STORE_PAGE_SIZE = 30;

/** Fields the store page itself reads for its holoviewer, and nothing it does not need. */
export const SHIP_LIST_QUERY = [
  "query ShipModels($query: SearchQuery!) {",
  '  store(name: "pledge", browse: true) {',
  "    search(query: $query) {",
  "      count",
  "      resources {",
  "        ... on RSIShip { id title slug url productionStatus media { ctm } }",
  "      }",
  "    }",
  "  }",
  "}",
].join("\n");

/** The request body for one page of the listing, every ship included, sorted by name. */
export function shipListBody(page: number): string {
  return JSON.stringify({
    query: SHIP_LIST_QUERY,
    variables: {
      query: {
        page,
        limit: STORE_PAGE_SIZE,
        sort: { field: "name", direction: "asc" },
        ships: { all: true },
      },
    },
  });
}

export const StoreShip = z.object({
  id: z.string().min(1),
  title: z.string(),
  slug: z.string().min(1),
  /** The ship page, as a path: `/pledge/ships/gladius/Gladius`. */
  url: z.string().startsWith("/"),
  productionStatus: z.string(),
  /** The holoviewer model's address, as a path or URL; null for a ship with no model. */
  media: z
    .object({ ctm: z.string().nullable().optional() })
    .nullable()
    .optional(),
});
export type StoreShip = z.infer<typeof StoreShip>;

const ListResponse = z.object({
  data: z.object({
    store: z.object({
      search: z.object({
        count: z.number().int().nonnegative(),
        resources: z.array(StoreShip),
      }),
    }),
  }),
});

/** The ship's model address, or null: the store writes an empty string for a ship without one. */
export function modelOf(ship: StoreShip): string | null {
  const ctm = ship.media?.ctm ?? null;
  return ctm === null || ctm.trim() === "" ? null : ctm;
}

/** The store answered with something this project has not seen: halt, never guess (CLAUDE.md section 5). */
export class StoreShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreShapeError";
  }
}

/** One page of the listing: the ships, or a `StoreShapeError` when the answer is not a listing. */
export function parseShipList(json: unknown): StoreShip[] {
  const parsed = ListResponse.safeParse(json);
  if (!parsed.success) {
    const errors =
      typeof json === "object" && json !== null && "errors" in json
        ? JSON.stringify((json as { errors: unknown }).errors).slice(0, 300)
        : null;
    throw new StoreShapeError(
      errors === null
        ? `store listing: ${parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")}`
        : `store listing: the store answered with errors ${errors}`,
    );
  }
  return parsed.data.data.store.search.resources;
}

/**
 * A pledge page's path with the origin and the language prefix removed, so
 * `https://robertsspaceindustries.com/pledge/ships/gladius/Gladius`,
 * `/en/pledge/ships/gladius/Gladius` and `/pledge/ships/gladius/Gladius` compare equal.
 */
export function pagePath(url: string): string {
  const path = url.startsWith("http") ? new URL(url).pathname : url;
  return path.replace(/^\/[a-z]{2}(?=\/pledge\/)/, "").replace(/\/+$/, "");
}

/** The model's address as the viewer resolves it: relative to the store's own origin. */
export function modelUrl(ctm: string): string {
  return new URL(ctm, RSI_ORIGIN).toString();
}

/** The file a model is kept under: RSI's media id, so a model two editions share is kept once. */
export function modelFile(ctm: string): string {
  const path = new URL(ctm, RSI_ORIGIN);
  const id =
    path.hostname === "media.robertsspaceindustries.com"
      ? path.pathname.split("/")[1]
      : path.pathname.match(/^\/media\/([a-z0-9]+)\//)?.[1];
  if (id === undefined || id === "") {
    throw new StoreShapeError(`model address of an unknown form: ${ctm}`);
  }
  return `${id}.ctm`;
}

export interface CatalogPage {
  /** The ship page slug: a pack slug, or a concept ship's slug. */
  readonly slug: string;
  /** The RSI pledge page `fetch-rsi.ts` recorded for the ship. */
  readonly page_url: string;
}

export interface ModelMatch {
  readonly slug: string;
  readonly page: string;
  readonly url: string;
  readonly file: string;
  readonly store_title: string;
}

export interface ModelMatchResult {
  readonly matched: readonly ModelMatch[];
  readonly unmatched: readonly { slug: string; reason: string }[];
  /** Store ships with a model that no catalog ship claims. */
  readonly unused: readonly StoreShip[];
}

/**
 * A catalog ship takes the model of the one store ship whose page is the ship's recorded pledge
 * page. Two store ships on one page, no store ship, or a store ship without a model: no model,
 * and the reason is reported.
 */
export function matchModels(
  catalog: readonly CatalogPage[],
  store: readonly StoreShip[],
): ModelMatchResult {
  const byPage = new Map<string, StoreShip[]>();
  for (const ship of store) {
    const key = pagePath(ship.url);
    byPage.set(key, [...(byPage.get(key) ?? []), ship]);
  }
  const matched: ModelMatch[] = [];
  const unmatched: { slug: string; reason: string }[] = [];
  const used = new Set<string>();
  for (const ship of catalog) {
    const rows = byPage.get(pagePath(ship.page_url)) ?? [];
    if (rows.length !== 1) {
      unmatched.push({
        slug: ship.slug,
        reason:
          rows.length === 0
            ? "the store lists no ship on this page"
            : `${rows.length} store ships share this page`,
      });
      continue;
    }
    const row = rows[0]!;
    const ctm = modelOf(row);
    if (ctm === null) {
      unmatched.push({ slug: ship.slug, reason: "the store has no model" });
      continue;
    }
    used.add(row.id);
    matched.push({
      slug: ship.slug,
      page: `${RSI_ORIGIN}${pagePath(row.url)}`,
      url: modelUrl(ctm),
      file: modelFile(ctm),
      store_title: row.title,
    });
  }
  return {
    matched,
    unmatched,
    unused: store.filter((s) => !used.has(s.id) && modelOf(s) !== null),
  };
}
