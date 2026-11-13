/**
 * A polite client for api.star-citizen.wiki. One serial queue spaces every request, including
 * retries, so the script can never exceed the CLAUDE.md section 9 limit of 30 requests per minute.
 * `fetch` and `sleep` are injected so unit tests run on fake timers with no network.
 *
 * Within one refresh run the steps read the same ships and parts: the patch snapshot, the
 * catalog, the descriptions and the prices each ask for every ship (ADR-059). With
 * `WIKI_RUN_CACHE_DIR` set (the refresh job sets it under RUNNER_TEMP) a ship, part or blueprint
 * read is kept on disk for the rest of the run and a later step's read of it costs no request.
 * Unset, as on a developer's machine, nothing is kept.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const WIKI_BASE_URL = "https://api.star-citizen.wiki";
export const DEFAULT_SPACING_MS = 2500;
export const DEFAULT_BACKOFF_MS: readonly number[] = [5_000, 20_000, 60_000];

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface WikiClientOptions {
  fetch: FetchLike;
  userAgent: string;
  baseUrl?: string;
  spacingMs?: number;
  backoffMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (event: Record<string, unknown>) => void;
  /** The run's response cache folder; defaults to WIKI_RUN_CACHE_DIR, null for none. */
  cacheDir?: string | null;
  /** The build the run read as the wiki's default; defaults to WIKI_RUN_BUILD. */
  build?: string | null;
}

export interface WikiClient {
  /** Fetches `baseUrl + path` as JSON, waiting for its turn in the queue. */
  getJson(path: string): Promise<unknown>;
  /** Requests sent so far, retries included. */
  readonly requests: number;
  /** Reads answered from the run's cache, with no request. */
  readonly cached: number;
}

/**
 * The cache key of a read, or null for one that is never kept: only ships, parts and blueprints
 * are, so a check of the wiki's builds always asks. Two spellings of one read share a key: a
 * ship's record is the same with or without `include=hardpoints` (the plain read carries its
 * ports too), and `version=` naming the build the run read is the default the wiki serves.
 */
export function cacheKey(path: string, build: string | null): string | null {
  const url = new URL(path, "https://wiki.invalid");
  if (!/^\/api\/(vehicles|items|blueprints)(\/|$)/.test(url.pathname))
    return null;
  const ship = /^\/api\/vehicles\/[^/]+$/.test(url.pathname);
  const params = [...url.searchParams.entries()]
    .filter(
      ([k, v]) =>
        !(k === "version" && build !== null && v === build) &&
        !(ship && k === "include" && v === "hardpoints"),
    )
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  return params.length === 0
    ? url.pathname
    : `${url.pathname}?${params.map(([k, v]) => `${k}=${v}`).join("&")}`;
}

export class FetchError extends Error {
  readonly url: string;
  readonly status: number | undefined;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = "FetchError";
    this.url = url;
    this.status = status;
  }
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createWikiClient(options: WikiClientOptions): WikiClient {
  const baseUrl = options.baseUrl ?? WIKI_BASE_URL;
  const spacingMs = options.spacingMs ?? DEFAULT_SPACING_MS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => undefined);
  const env = (name: string): string | null => {
    const value = (process.env[name] ?? "").trim();
    return value === "" ? null : value;
  };
  const cacheDir =
    options.cacheDir === undefined
      ? env("WIKI_RUN_CACHE_DIR")
      : options.cacheDir;
  const build =
    options.build === undefined ? env("WIKI_RUN_BUILD") : options.build;
  const cacheFile = (path: string): string | null => {
    if (cacheDir === null) return null;
    const key = cacheKey(path, build);
    return key === null
      ? null
      : join(
          cacheDir,
          `${createHash("sha1").update(`${baseUrl}${key}`).digest("hex")}.json`,
        );
  };
  let cached = 0;
  const headers = {
    "User-Agent": options.userAgent,
    Accept: "application/json",
  };

  let queue: Promise<unknown> = Promise.resolve();
  let lastStart = Number.NEGATIVE_INFINITY;
  let requests = 0;

  async function once(url: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      const wait = lastStart + spacingMs - now();
      if (wait > 0) await sleep(wait);
      lastStart = now();
      requests += 1;

      let response: Awaited<ReturnType<FetchLike>>;
      try {
        response = await options.fetch(url, { headers });
      } catch (error) {
        const backoff = backoffMs[attempt];
        if (backoff === undefined) {
          throw new FetchError(
            `network error after ${attempt + 1} attempts: ${String(error)}`,
            url,
          );
        }
        log({
          event: "bootstrap.fetch.retry",
          url,
          attempt,
          reason: "network",
          backoff_ms: backoff,
        });
        await sleep(backoff);
        continue;
      }

      if (response.ok) {
        try {
          return await response.json();
        } catch (error) {
          throw new FetchError(
            `response is not JSON: ${String(error)}`,
            url,
            response.status,
          );
        }
      }

      const retryable = response.status === 429 || response.status >= 500;
      const backoff = backoffMs[attempt];
      if (retryable && backoff !== undefined) {
        log({
          event: "bootstrap.fetch.retry",
          url,
          attempt,
          status: response.status,
          backoff_ms: backoff,
        });
        await sleep(backoff);
        continue;
      }
      throw new FetchError(`HTTP ${response.status}`, url, response.status);
    }
  }

  return {
    getJson(path: string): Promise<unknown> {
      const file = cacheFile(path);
      if (file !== null && existsSync(file)) {
        cached += 1;
        return Promise.resolve(JSON.parse(readFileSync(file, "utf8")));
      }
      const url = baseUrl + path;
      const turn = queue.then(() => once(url));
      queue = turn.catch(() => undefined);
      if (file === null) return turn;
      return turn.then((json) => {
        mkdirSync(cacheDir!, { recursive: true });
        writeFileSync(file, JSON.stringify(json), "utf8");
        return json;
      });
    },
    get requests(): number {
      return requests;
    },
    get cached(): number {
      return cached;
    },
  };
}
